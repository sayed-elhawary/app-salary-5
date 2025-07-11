import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import sanitizeHtml from 'sanitize-html';

const router = express.Router();

// التحقق من وجود JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  throw new Error('JWT_SECRET is required');
}

// Middleware للتحقق من صحة التوكن
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.error('No token provided in request');
    return res.status(401).json({ message: 'غير مصرح، يرجى تقديم توكن' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Invalid token:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'التوكن منتهي الصلاحية' });
    }
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
};

// Middleware للتحقق من صلاحية الأدمن
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.error('No token provided in request');
    return res.status(401).json({ message: 'غير مصرح، يرجى تقديم توكن' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      console.error('User is not admin:', decoded);
      return res.status(403).json({ message: 'للأدمن فقط' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Invalid token:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'التوكن منتهي الصلاحية' });
    }
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
};

// تسجيل الدخول
router.post('/login', async (req, res) => {
  const { code, password } = req.body;
  console.log('Login attempt:', { code });

  if (!code || !password) {
    console.error('Missing code or password');
    return res.status(400).json({ message: 'يرجى إدخال كود المستخدم وكلمة المرور' });
  }

  try {
    const user = await User.findOne({ code: sanitizeHtml(code) });
    if (!user) {
      console.error(`User with code ${code} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.error(`Invalid password for user ${code}`);
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { _id: user._id, code: user.code, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`Login successful for user ${code}`);
    res.json({
      token,
      user: {
        code: user.code,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ message: 'خطأ في تسجيل الدخول: ' + error.message });
  }
});

// جلب بيانات المستخدم الحالي بناءً على التوكن
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ code: req.user.code }).select('-password');
    if (!user) {
      console.error(`User with code ${req.user.code} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    let netSalaryData = { netSalary: 0 };
    try {
      netSalaryData = await user.netSalary;
    } catch (err) {
      console.warn(`Failed to calculate netSalary for user ${req.user.code}: ${err.message}`);
    }

    res.json({
      user: {
        ...user.toObject(),
        netSalary: netSalaryData.netSalary || 0,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    console.error('Error fetching current user:', err.message, err.stack);
    res.status(500).json({ message: 'خطأ في جلب بيانات المستخدم: ' + err.message });
  }
});

// جلب جميع المستخدمين أو مستخدم معين بناءً على الكود
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { code } = req.query;
    let users;
    if (code) {
      users = await User.find({ code: sanitizeHtml(code) }).select('-password');
      if (users.length === 0) {
        console.error(`No users found with code ${code}`);
        return res.status(404).json({ message: 'لا يوجد مستخدم بهذا الكود' });
      }
    } else {
      users = await User.find().select('-password');
    }

    const usersWithNetSalary = await Promise.all(
      users.map(async (user) => {
        let netSalaryData = { netSalary: 0 };
        try {
          netSalaryData = await user.netSalary;
        } catch (err) {
          console.warn(`Failed to calculate netSalary for user ${user.code}: ${err.message}`);
        }
        return {
          ...user.toObject(),
          netSalary: netSalaryData.netSalary || 0,
          fullName: user.fullName,
        };
      })
    );

    res.json({ users: usersWithNetSalary });
  } catch (err) {
    console.error('Error fetching users:', err.message, err.stack);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين: ' + err.message });
  }
});

// إنشاء مستخدم جديد
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      code,
      fullName,
      password,
      department,
      baseSalary,
      baseBonus,
      bonusPercentage,
      mealAllowance,
      medicalInsurance,
      socialInsurance,
      workDaysPerWeek,
      status,
      createdBy,
      annualLeaveBalance,
      eidBonus,
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      totalOfficialLeaveDays,
      monthlyLateAllowance,
      customAnnualLeave,
    } = req.body;

    // تنظيف المدخلات النصية
    const sanitizedCode = sanitizeHtml(code);
    const sanitizedFullName = sanitizeHtml(fullName);
    const sanitizedDepartment = sanitizeHtml(department);

    // التحقق من الحقول المطلوبة
    if (!sanitizedCode || !sanitizedFullName || !password || !sanitizedDepartment || !baseSalary || !bonusPercentage) {
      console.error('Missing required fields:', {
        code,
        fullName,
        password,
        department,
        baseSalary,
        bonusPercentage,
      });
      return res.status(400).json({ message: 'جميع الحقول المطلوبة يجب أن تكون موجودة' });
    }

    // التحقق من القيم الرقمية
    const numericFields = {
      baseSalary,
      baseBonus,
      bonusPercentage,
      mealAllowance,
      medicalInsurance,
      socialInsurance,
      workDaysPerWeek,
      annualLeaveBalance,
      eidBonus,
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      totalOfficialLeaveDays,
      monthlyLateAllowance,
      customAnnualLeave,
    };

    for (const [key, value] of Object.entries(numericFields)) {
      if (value !== undefined && (isNaN(value) || value < 0)) {
        console.error(`Invalid ${key}: ${value}`);
        return res.status(400).json({ message: `قيمة ${key} يجب أن تكون رقمًا موجبًا` });
      }
    }

    // التحقق من طول كلمة المرور
    if (password.length < 6) {
      console.error('Password too short:', password);
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    // التحقق من تنسيق كلمة المرور
    if (password.startsWith('$2a$') || password.startsWith('$2b$')) {
      console.error(`Invalid password format for user ${sanitizedCode}: ${password}`);
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون نصًا عاديًا، وليس تجزئة' });
    }

    // التحقق من وجود مستخدم بنفس الكود
    const existingUser = await User.findOne({ code: sanitizedCode });
    if (existingUser) {
      console.error(`User with code ${sanitizedCode} already exists`);
      return res.status(400).json({ message: 'الكود مستخدم بالفعل' });
    }

    // التحقق من createdBy
    let createdById = req.user._id;
    if (createdBy && createdBy !== req.user._id) {
      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        console.error(`Invalid createdBy ID: ${createdBy}`);
        return res.status(400).json({ message: 'معرف createdBy غير صالح' });
      }
      createdById = createdBy;
    }

    // إنشاء مستخدم جديد
    const user = new User({
      code: sanitizedCode,
      fullName: sanitizedFullName,
      password,
      department: sanitizedDepartment,
      baseSalary,
      baseBonus: baseBonus || 0,
      bonusPercentage: bonusPercentage || 0,
      mealAllowance: mealAllowance || 0,
      medicalInsurance: medicalInsurance || 0,
      socialInsurance: socialInsurance || 0,
      workDaysPerWeek: workDaysPerWeek || 5,
      status: status || 'active',
      createdBy: createdById,
      annualLeaveBalance: annualLeaveBalance || 21,
      eidBonus: eidBonus || 0,
      penaltiesValue: penaltiesValue || 0,
      violationsInstallment: violationsInstallment || 0,
      totalViolationsValue: totalViolationsValue || 0,
      advances: advances || 0,
      totalOfficialLeaveDays: totalOfficialLeaveDays || 0,
      monthlyLateAllowance: monthlyLateAllowance || 120,
      customAnnualLeave: customAnnualLeave || 0,
      role: 'user',
    });

    await user.save();
    console.log(`User ${sanitizedCode} created successfully`);
    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح', user: { ...user.toObject(), fullName: user.fullName } });
  } catch (err) {
    console.error('Error creating user:', err.message, err.stack);
    if (err.name === 'MongoError' && err.code === 11000) {
      return res.status(400).json({ message: 'الكود مستخدم بالفعل' });
    }
    res.status(500).json({ message: 'خطأ في إنشاء المستخدم: ' + err.message });
  }
});

// تحديث مستخدم
router.put('/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const {
      fullName,
      password,
      department,
      baseSalary,
      baseBonus,
      bonusPercentage,
      mealAllowance,
      medicalInsurance,
      socialInsurance,
      workDaysPerWeek,
      status,
      createdBy,
      annualLeaveBalance,
      eidBonus,
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      totalOfficialLeaveDays,
      monthlyLateAllowance,
      customAnnualLeave,
    } = req.body;

    // تنظيف المدخلات النصية
    const sanitizedCode = sanitizeHtml(code);
    const sanitizedFullName = fullName ? sanitizeHtml(fullName) : undefined;
    const sanitizedDepartment = department ? sanitizeHtml(department) : undefined;

    // التحقق من وجود المستخدم
    const user = await User.findOne({ code: sanitizedCode });
    if (!user) {
      console.error(`User with code ${sanitizedCode} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من القيم الرقمية
    const numericFields = {
      baseSalary,
      baseBonus,
      bonusPercentage,
      mealAllowance,
      medicalInsurance,
      socialInsurance,
      workDaysPerWeek,
      annualLeaveBalance,
      eidBonus,
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      totalOfficialLeaveDays,
      monthlyLateAllowance,
      customAnnualLeave,
    };

    for (const [key, value] of Object.entries(numericFields)) {
      if (value !== undefined && (isNaN(value) || value < 0)) {
        console.error(`Invalid ${key}: ${value}`);
        return res.status(400).json({ message: `قيمة ${key} يجب أن تكون رقمًا موجبًا` });
      }
    }

    // التحقق من كلمة المرور إذا تم تقديمها
    if (password) {
      if (password.length < 6) {
        console.error('Password too short:', password);
        return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      }
      if (password.startsWith('$2a$') || password.startsWith('$2b$')) {
        console.error(`Invalid password format for user ${sanitizedCode}: ${password}`);
        return res.status(400).json({ message: 'كلمة المرور يجب أن تكون نصًا عاديًا، وليس تجزئة' });
      }
      try {
        user.password = password;
        await user.save(); // سيتم تشفير كلمة المرور في pre-save hook
      } catch (err) {
        console.error('Error hashing password:', err.message);
        return res.status(500).json({ message: 'خطأ أثناء تشفير كلمة المرور' });
      }
    }

    // تحديث الحقول
    if (sanitizedFullName) user.fullName = sanitizedFullName;
    if (sanitizedDepartment) user.department = sanitizedDepartment;
    if (baseSalary !== undefined) user.baseSalary = baseSalary;
    if (baseBonus !== undefined) user.baseBonus = baseBonus;
    if (bonusPercentage !== undefined) user.bonusPercentage = bonusPercentage;
    if (mealAllowance !== undefined) user.mealAllowance = mealAllowance;
    if (medicalInsurance !== undefined) user.medicalInsurance = medicalInsurance;
    if (socialInsurance !== undefined) user.socialInsurance = socialInsurance;
    if (workDaysPerWeek !== undefined) user.workDaysPerWeek = workDaysPerWeek;
    if (status) user.status = status;
    if (annualLeaveBalance !== undefined) user.annualLeaveBalance = annualLeaveBalance;
    if (eidBonus !== undefined) user.eidBonus = eidBonus;
    if (penaltiesValue !== undefined) user.penaltiesValue = penaltiesValue;
    if (violationsInstallment !== undefined) user.violationsInstallment = violationsInstallment;
    if (totalViolationsValue !== undefined) user.totalViolationsValue = totalViolationsValue;
    if (advances !== undefined) user.advances = advances;
    if (totalOfficialLeaveDays !== undefined) user.totalOfficialLeaveDays = totalOfficialLeaveDays;
    if (monthlyLateAllowance !== undefined) user.monthlyLateAllowance = monthlyLateAllowance;
    if (customAnnualLeave !== undefined) user.customAnnualLeave = customAnnualLeave;
    if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
      user.createdBy = createdBy;
    }

    await user.save();

    let netSalaryData = { netSalary: 0 };
    try {
      netSalaryData = await user.netSalary;
    } catch (err) {
      console.warn(`Failed to calculate netSalary for user ${sanitizedCode}: ${err.message}`);
    }

    console.log(`User ${sanitizedCode} updated successfully`);
    res.json({
      message: password ? 'تم تحديث المستخدم وكلمة المرور بنجاح' : 'تم تحديث المستخدم بنجاح',
      user: { ...user.toObject(), netSalary: netSalaryData.netSalary || 0, fullName: user.fullName },
    });
  } catch (err) {
    console.error('Error updating user:', err.message, err.stack);
    res.status(500).json({ message: 'خطأ في تحديث المستخدم: ' + err.message });
  }
});

// حذف مستخدم
router.delete('/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const sanitizedCode = sanitizeHtml(code);

    const user = await User.findOne({ code: sanitizedCode });
    if (!user) {
      console.error(`User with code ${sanitizedCode} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (user.role === 'admin') {
      console.error(`Cannot delete admin user ${sanitizedCode}`);
      return res.status(403).json({ message: 'لا يمكن حذف مستخدم بصلاحيات الأدمن' });
    }

    await User.deleteOne({ code: sanitizedCode });
    console.log(`User ${sanitizedCode} deleted successfully`);
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    console.error('Error deleting user:', err.message, err.stack);
    res.status(500).json({ message: 'خطأ في حذف المستخدم: ' + err.message });
  }
});

// تحديث جماعي للمستخدمين
router.post('/bulk-update', authMiddleware, async (req, res) => {
  try {
    const {
      monthlyLateAllowanceChange,
      baseSalaryPercentage,
      baseBonusIncrement,
      medicalInsurance,
      socialInsurance,
      excludedUsers,
      createdBy,
    } = req.body;

    // التحقق من القيم الرقمية
    if (monthlyLateAllowanceChange && isNaN(monthlyLateAllowanceChange)) {
      console.error(`Invalid monthlyLateAllowanceChange: ${monthlyLateAllowanceChange}`);
      return res.status(400).json({ message: 'رصيد السماح الشهري يجب أن يكون رقمًا' });
    }

    if (baseSalaryPercentage && (isNaN(baseSalaryPercentage) || baseSalaryPercentage < 0)) {
      console.error(`Invalid baseSalaryPercentage: ${baseSalaryPercentage}`);
      return res.status(400).json({ message: 'نسبة الراتب الأساسي يجب أن تكون رقمًا موجبًا' });
    }

    if (baseBonusIncrement && (isNaN(baseBonusIncrement) || baseBonusIncrement < 0)) {
      console.error(`Invalid baseBonusIncrement: ${baseBonusIncrement}`);
      return res.status(400).json({ message: 'زيادة الحافز الأساسي يجب أن تكون رقمًا موجبًا' });
    }

    if (medicalInsurance && (isNaN(medicalInsurance) || medicalInsurance < 0)) {
      console.error(`Invalid medicalInsurance: ${medicalInsurance}`);
      return res.status(400).json({ message: 'التأمين الطبي يجب أن يكون رقمًا موجبًا' });
    }

    if (socialInsurance && (isNaN(socialInsurance) || socialInsurance < 0)) {
      console.error(`Invalid socialInsurance: ${socialInsurance}`);
      return res.status(400).json({ message: 'التأمين الاجتماعي يجب أن تكون رقمًا موجبًا' });
    }

    // جلب جميع المستخدمين باستثناء المستبعدين
    const query = { role: { $ne: 'admin' } };
    if (excludedUsers && Array.isArray(excludedUsers) && excludedUsers.length > 0) {
      query.code = { $nin: excludedUsers.map((code) => sanitizeHtml(code)) };
    }

    const users = await User.find(query);
    if (users.length === 0) {
      console.error('No users found for bulk update');
      return res.status(404).json({ message: 'لا يوجد مستخدمين لتحديثهم' });
    }

    // تحديث المستخدمين
    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (monthlyLateAllowanceChange) {
          user.monthlyLateAllowance = (user.monthlyLateAllowance || 0) + parseFloat(monthlyLateAllowanceChange);
          if (user.monthlyLateAllowance < 0) user.monthlyLateAllowance = 0;
        }
        if (baseSalaryPercentage) {
          user.baseSalary = user.baseSalary * (1 + parseFloat(baseSalaryPercentage) / 100);
        }
        if (baseBonusIncrement) {
          user.baseBonus = (user.baseBonus || 0) + parseFloat(baseBonusIncrement);
        }
        if (medicalInsurance !== undefined) {
          user.medicalInsurance = parseFloat(medicalInsurance);
        }
        if (socialInsurance !== undefined) {
          user.socialInsurance = parseFloat(socialInsurance);
        }
        if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
          user.createdBy = createdBy;
        }

        await user.save();
        let netSalaryData = { netSalary: 0 };
        try {
          netSalaryData = await user.netSalary;
        } catch (err) {
          console.warn(`Failed to calculate netSalary for user ${user.code}: ${err.message}`);
        }

        return { ...user.toObject(), netSalary: netSalaryData.netSalary || 0, fullName: user.fullName };
      })
    );

    console.log(`Bulk update completed for ${updatedUsers.length} users`);
    res.json({ message: 'تم التحديث الجماعي بنجاح', users: updatedUsers });
  } catch (err) {
    console.error('Error in bulk update:', err.message, err.stack);
    res.status(500).json({ message: 'خطأ في التحديث الجماعي: ' + err.message });
  }
});

export default router;
