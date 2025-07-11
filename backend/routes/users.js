import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import sanitizeHtml from 'sanitize-html';

const router = express.Router();

// التحقق من وجود JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  throw new Error('JWT_SECRET is required');
}

// Middleware للتحقق من صحة التوكن فقط
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

// جلب بيانات المستخدم الحالي بناءً على التوكن
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ code: req.user.code }).select('-password');
    if (!user) {
      console.error(`User with code ${req.user.code} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    const netSalaryData = await user.netSalary;
    res.json({
      user: { ...user.toObject(), netSalary: netSalaryData.netSalary, employeeName: user.fullName },
    });
  } catch (err) {
    console.error('Error fetching current user:', err.message);
    res.status(500).json({ message: 'خطأ في جلب بيانات المستخدم: ' + err.message });
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
      console.error('Missing required fields:', { code, fullName, password, department, baseSalary, bonusPercentage });
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

    // التحقق من وجود مستخدم بنفس الكود
    const existingUser = await User.findOne({ code: sanitizedCode });
    if (existingUser) {
      console.error(`User with code ${sanitizedCode} already exists`);
      return res.status(400).json({ message: 'الكود مستخدم بالفعل' });
    }

    // إنشاء مستخدم جديد
    const user = new User({
      code: sanitizedCode,
      fullName: sanitizedFullName,
      password, // سيتم تشفير كلمة المرور في middleware pre-save
      department: sanitizedDepartment,
      baseSalary: parseFloat(baseSalary) || 0,
      baseBonus: parseFloat(baseBonus) || 0,
      bonusPercentage: parseFloat(bonusPercentage) || 0,
      mealAllowance: parseFloat(mealAllowance) || 500,
      medicalInsurance: parseFloat(medicalInsurance) || 0,
      socialInsurance: parseFloat(socialInsurance) || 0,
      workDaysPerWeek: parseInt(workDaysPerWeek) || 5,
      status: status || 'active',
      createdBy: createdBy || req.user.code,
      annualLeaveBalance: parseInt(annualLeaveBalance) || 21,
      role: 'user',
      eidBonus: parseFloat(eidBonus) || 0,
      penaltiesValue: parseFloat(penaltiesValue) || 0,
      violationsInstallment: parseFloat(violationsInstallment) || 0,
      totalViolationsValue: parseFloat(totalViolationsValue) || 0,
      advances: parseFloat(advances) || 0,
      totalOfficialLeaveDays: parseInt(totalOfficialLeaveDays) || 0,
      monthlyLateAllowance: parseFloat(monthlyLateAllowance) || 120,
      customAnnualLeave: parseInt(customAnnualLeave) || 0,
    });

    await user.save();
    const netSalaryData = await user.netSalary;
    console.log(`User created successfully: ${sanitizedCode}`, {
      violationsInstallment: user.violationsInstallment,
      baseSalary: user.baseSalary,
      advances: user.advances,
      netSalary: netSalaryData.netSalary,
    });
    res.status(201).json({
      user: { ...user.toObject(), netSalary: netSalaryData.netSalary, employeeName: user.fullName },
    });
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(400).json({ message: 'خطأ في إنشاء المستخدم: ' + err.message });
  }
});

// تحديث بيانات مستخدم
router.put('/:code', authMiddleware, async (req, res) => {
  const cache = req.app.get('cache'); // جلب cache من app
  try {
    console.log('Received update request for user:', req.params.code, 'Data:', req.body);
    const {
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      deductionsValue,
      createdBy,
      monthlyLateAllowance,
      baseSalary,
      baseBonus,
      bonusPercentage,
      mealAllowance,
      medicalInsurance,
      socialInsurance,
      workDaysPerWeek,
      status,
      annualLeaveBalance,
      eidBonus,
      customAnnualLeave,
      totalOfficialLeaveDays,
    } = req.body;

    // التحقق من وجود حقل واحد على الأقل للتعديل
    if (
      penaltiesValue === undefined &&
      violationsInstallment === undefined &&
      advances === undefined &&
      totalViolationsValue === undefined &&
      deductionsValue === undefined &&
      monthlyLateAllowance === undefined &&
      baseSalary === undefined &&
      baseBonus === undefined &&
      bonusPercentage === undefined &&
      mealAllowance === undefined &&
      medicalInsurance === undefined &&
      socialInsurance === undefined &&
      workDaysPerWeek === undefined &&
      status === undefined &&
      annualLeaveBalance === undefined &&
      eidBonus === undefined &&
      customAnnualLeave === undefined &&
      totalOfficialLeaveDays === undefined
    ) {
      console.error('No valid fields provided for update');
      return res.status(400).json({ message: 'يجب تقديم حقل واحد على الأقل للتعديل' });
    }

    // التحقق من القيم الرقمية
    const numericFields = {
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      deductionsValue,
      monthlyLateAllowance,
      baseSalary,
      baseBonus,
      bonusPercentage,
      mealAllowance,
      medicalInsurance,
      socialInsurance,
      workDaysPerWeek,
      annualLeaveBalance,
      eidBonus,
      customAnnualLeave,
      totalOfficialLeaveDays,
    };
    for (const [key, value] of Object.entries(numericFields)) {
      if (value !== undefined && (isNaN(value) || value < 0)) {
        console.error(`Invalid ${key}: ${value}`);
        return res.status(400).json({ message: `قيمة ${key} يجب أن تكون رقمًا موجبًا` });
      }
    }

    // البحث عن المستخدم
    const user = await User.findOne({ code: req.params.code });
    if (!user) {
      console.error(`User with code ${req.params.code} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديث الحقول المسموح بها فقط
    user.penaltiesValue = penaltiesValue !== undefined ? parseFloat(penaltiesValue) : user.penaltiesValue;
    user.violationsInstallment = violationsInstallment !== undefined ? parseFloat(violationsInstallment) : user.violationsInstallment;
    user.totalViolationsValue = totalViolationsValue !== undefined ? parseFloat(totalViolationsValue) : user.totalViolationsValue;
    user.advances = advances !== undefined ? parseFloat(advances) : user.advances;
    user.deductionsValue = deductionsValue !== undefined ? parseFloat(deductionsValue) : user.deductionsValue;
    user.monthlyLateAllowance = monthlyLateAllowance !== undefined ? parseFloat(monthlyLateAllowance) : user.monthlyLateAllowance;
    user.baseSalary = baseSalary !== undefined ? parseFloat(baseSalary) : user.baseSalary;
    user.baseBonus = baseBonus !== undefined ? parseFloat(baseBonus) : user.baseBonus;
    user.bonusPercentage = bonusPercentage !== undefined ? parseFloat(bonusPercentage) : user.bonusPercentage;
    user.mealAllowance = mealAllowance !== undefined ? parseFloat(mealAllowance) : user.mealAllowance;
    user.medicalInsurance = medicalInsurance !== undefined ? parseFloat(medicalInsurance) : user.medicalInsurance;
    user.socialInsurance = socialInsurance !== undefined ? parseFloat(socialInsurance) : user.socialInsurance;
    user.workDaysPerWeek = workDaysPerWeek !== undefined ? parseInt(workDaysPerWeek) : user.workDaysPerWeek;
    user.status = status !== undefined ? status : user.status;
    user.annualLeaveBalance = annualLeaveBalance !== undefined ? parseInt(annualLeaveBalance) : user.annualLeaveBalance;
    user.eidBonus = eidBonus !== undefined ? parseFloat(eidBonus) : user.eidBonus;
    user.customAnnualLeave = customAnnualLeave !== undefined ? parseInt(customAnnualLeave) : user.customAnnualLeave;
    user.totalOfficialLeaveDays = totalOfficialLeaveDays !== undefined ? parseInt(totalOfficialLeaveDays) : user.totalOfficialLeaveDays;
    user.createdBy = createdBy || user.createdBy;

    // تسجيل البيانات قبل الحفظ
    console.log('Data before save:', {
      code: user.code,
      penaltiesValue: user.penaltiesValue,
      violationsInstallment: user.violationsInstallment,
      totalViolationsValue: user.totalViolationsValue,
      advances: user.advances,
      deductionsValue: user.deductionsValue,
      monthlyLateAllowance: user.monthlyLateAllowance,
      baseSalary: user.baseSalary,
      baseBonus: user.baseBonus,
      bonusPercentage: user.bonusPercentage,
      mealAllowance: user.mealAllowance,
      medicalInsurance: user.medicalInsurance,
      socialInsurance: user.socialInsurance,
      workDaysPerWeek: user.workDaysPerWeek,
      status: user.status,
      annualLeaveBalance: user.annualLeaveBalance,
      eidBonus: user.eidBonus,
      customAnnualLeave: user.customAnnualLeave,
      totalOfficialLeaveDays: user.totalOfficialLeaveDays,
    });

    // حفظ التغييرات
    try {
      await user.save();
      console.log('User saved successfully:', user.code);
    } catch (saveError) {
      console.error('Error saving user:', saveError.message);
      return res.status(500).json({ message: 'خطأ أثناء حفظ التغييرات: ' + saveError.message });
    }

    // إبطال ذاكرة التخزين المؤقت المرتبطة بالمستخدم
    try {
      const cacheKeys = cache.keys().filter(key => key.includes(`${req.params.code}:`));
      cacheKeys.forEach(key => {
        console.log(`Invalidating cache key: ${key}`);
        cache.del(key);
      });
    } catch (cacheError) {
      console.error('Error invalidating cache:', cacheError.message);
    }

    // جلب البيانات المحدثة
    const netSalaryData = await user.netSalary;
    console.log('Updated user:', {
      code: user.code,
      penaltiesValue: user.penaltiesValue,
      violationsInstallment: user.violationsInstallment,
      totalViolationsValue: user.totalViolationsValue,
      advances: user.advances,
      deductionsValue: user.deductionsValue,
      monthlyLateAllowance: user.monthlyLateAllowance,
      netSalary: netSalaryData.netSalary,
    });

    res.json({
      message: 'تم تحديث المستخدم بنجاح',
      user: { ...user.toObject(), netSalary: netSalaryData.netSalary, employeeName: user.fullName },
    });
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).json({ message: 'خطأ في تحديث المستخدم: ' + error.message });
  }
});

// جلب بيانات مستخدم بناءً على الكود
router.get('/:code', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ code: req.params.code }).select('-password');
    if (!user) {
      console.error(`User with code ${req.params.code} not found`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    const netSalaryData = await user.netSalary;
    res.json({
      user: { ...user.toObject(), netSalary: netSalaryData.netSalary, employeeName: user.fullName },
    });
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).json({ message: 'خطأ في جلب المستخدم: ' + err.message });
  }
});

// جلب جميع المستخدمين
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { code } = req.query;
    if (code) {
      // البحث عن مستخدم واحد بناءً على الكود
      const user = await User.findOne({ code }).select('-password');
      if (!user) {
        console.error(`User with code ${code} not found`);
        return res.status(404).json({ message: 'المستخدم غير موجود' });
      }
      const netSalaryData = await user.netSalary;
      return res.json({
        users: [{ ...user.toObject(), netSalary: netSalaryData.netSalary, employeeName: user.fullName }],
      });
    }

    // جلب جميع المستخدمين
    const users = await User.find().select('-password');
    const usersWithNetSalary = await Promise.all(
      users.map(async (user) => {
        const netSalaryData = await user.netSalary;
        return { ...user.toObject(), netSalary: netSalaryData.netSalary, employeeName: user.fullName };
      })
    );
    res.json({ users: usersWithNetSalary });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين: ' + err.message });
  }
});

export default router;
