import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// التحقق من وجود JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  throw new Error('JWT_SECRET is required');
}

router.post('/login', async (req, res) => {
  const { code, password } = req.body;
  try {
    // التحقق من وجود الكود وكلمة المرور
    if (!code || !password) {
      console.error('Missing code or password:', { code, password: '[REDACTED]' });
      return res.status(400).json({ message: 'كود الموظف وكلمة المرور مطلوبان' });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ code });
    if (!user) {
      console.error(`User with code ${code} not found`);
      return res.status(401).json({ message: 'كود الموظف غير صحيح' });
    }

    // التحقق من أن حقل كلمة المرور ليس فارغًا ومشفر بشكل صحيح
    if (!user.password || (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$'))) {
      console.error(`Invalid password format for user ${code}:`, user.password);
      return res.status(500).json({ message: 'خطأ في بيانات المستخدم: كلمة المرور غير صالحة' });
    }

    // مقارنة كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error(`Invalid password for user ${code}`);
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }

    // التحقق من حالة المستخدم
    if (user.status !== 'active') {
      console.error(`User ${code} is not active, status: ${user.status}`);
      return res.status(403).json({ message: 'الحساب غير نشط. يرجى التواصل مع الأدمن.' });
    }

    // إبطال الكاش للمستخدم (إذا كنت تستخدم ذاكرة تخزين مؤقت)
    try {
      const cache = req.app.get('cache');
      if (cache && typeof cache.keys === 'function' && typeof cache.del === 'function') {
        const cacheKeys = cache.keys().filter(key => key.includes(`${code}:`));
        cacheKeys.forEach(key => {
          console.log(`Invalidating cache key: ${key}`);
          cache.del(key);
        });
      } else {
        console.warn('Cache is not properly configured or not available');
      }
    } catch (cacheError) {
      console.error('Error invalidating cache:', cacheError.message, cacheError.stack);
    }

    // إنشاء توكن JWT
    const token = jwt.sign(
      { code: user.code, role: user.role, _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // تمديد صلاحية التوكن إلى 7 أيام
    );

    // جلب بيانات الراتب الصافي
    let netSalaryData;
    try {
      netSalaryData = await user.netSalary;
    } catch (netSalaryError) {
      console.error(`Error calculating netSalary for user ${code}:`, netSalaryError.message, netSalaryError.stack);
      netSalaryData = { netSalary: 0, fullName: user.fullName };
    }

    res.json({
      message: 'تسجيل الدخول ناجح',
      token,
      user: {
        code: user.code,
        role: user.role,
        fullName: user.fullName, // تغيير من employeeName إلى fullName
        netSalary: netSalaryData.netSalary || 0,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error.message, error.stack);
    res.status(500).json({ message: 'خطأ في السيرفر: ' + error.message });
  }
});

export default router;
