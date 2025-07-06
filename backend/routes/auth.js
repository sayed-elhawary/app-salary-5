import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { code, password } = req.body;
  try {
    if (!code || !password) {
      console.error('Missing code or password');
      return res.status(400).json({ message: 'كود الموظف وكلمة المرور مطلوبان' });
    }

    const user = await User.findOne({ code });
    if (!user) {
      console.error(`User with code ${code} not found`);
      return res.status(401).json({ message: 'كود غير صحيح' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error('Invalid password for user:', code);
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }

    if (user.status !== 'active') {
      console.error(`User ${code} is not active`);
      return res.status(403).json({ message: 'الحساب غير نشط' });
    }

    const token = jwt.sign(
      { code: user.code, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const netSalaryData = await user.netSalary;
    res.json({
      token,
      user: {
        code: user.code,
        role: user.role,
        employeeName: user.fullName,
        netSalary: netSalaryData.netSalary,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ message: 'خطأ في السيرفر: ' + error.message });
  }
});

export default router;
