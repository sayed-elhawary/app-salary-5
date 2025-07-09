// backend/routes/bonus-reports.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import MonthlyBonusReport from '../models/MonthlyBonusReport.js';
import User from '../models/User.js';
import Fingerprint from '../models/Fingerprint.js';

const router = express.Router();

// التحقق من التوكن
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.error('No token provided in request');
    return res.status(401).json({ message: 'غير مصرح' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.code) {
      console.error('No user code found in token:', decoded);
      return res.status(401).json({ message: 'معرف المستخدم غير موجود في التوكن' });
    }
    const user = await User.findOne({ code: decoded.code });
    if (!user) {
      console.error(`User not found for code ${decoded.code}`);
      return res.status(401).json({ message: 'المستخدم غير موجود' });
    }
    req.user = { ...decoded, _id: user._id };
    next();
  } catch (error) {
    console.error('Invalid token:', error.message);
    return res.status(401).json({ message: 'توكن غير صالح', details: error.message });
  }
};

// التحقق من صلاحية الأدمن
const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    console.error('User is not admin:', req.user);
    return res.status(403).json({ message: 'للأدمن فقط' });
  }
  next();
};

// دالة لحساب بيانات الحضور من Fingerprint
const calculateAttendanceStats = async (code, startDate, endDate) => {
  try {
    const fingerprints = await Fingerprint.find({
      code,
      date: { $gte: startDate.toJSDate(), $lte: endDate.toJSDate() },
    });

    console.log(`Retrieved ${fingerprints.length} fingerprints for code ${code} from ${startDate.toISODate()} to ${endDate.toISODate()}`);

    const user = await User.findOne({ code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${code}`);
    }

    const workDaysPerWeek = user.workDaysPerWeek || 6;
    const isWeeklyLeaveDay = (date) => {
      const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
      return (
        (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
        (workDaysPerWeek === 6 && dayOfWeek === 5)
      );
    };

    let totalWorkDays = 0;
    let absences = 0;
    let annualLeave = 0;
    let medicalLeave = 0;

    fingerprints.forEach((fp) => {
      const isWorkDay =
        !fp.absence &&
        !fp.annualLeave &&
        !fp.medicalLeave &&
        !fp.officialLeave &&
        fp.leaveCompensation === 0 &&
        fp.appropriateValue === 0 &&
        !isWeeklyLeaveDay(fp.date);
      if (isWorkDay) totalWorkDays += 1;
      if (fp.absence) absences += 1;
      if (fp.annualLeave) annualLeave += 1;
      if (fp.medicalLeave) medicalLeave += 1;
    });

    const totalLeaveDays = fingerprints.reduce((acc, fp) => {
      return acc + (fp.annualLeave || fp.medicalLeave || fp.officialLeave || fp.leaveCompensation ? 1 : 0);
    }, 0);

    console.log(`Attendance stats for ${code}: totalWorkDays=${totalWorkDays}, absences=${absences}, annualLeave=${annualLeave}, medicalLeave=${medicalLeave}, totalLeaveDays=${totalLeaveDays}`);

    return { totalWorkDays, absences, annualLeave, medicalLeave, totalLeaveDays };
  } catch (error) {
    console.error(`Error calculating attendance stats for code ${code}:`, error.message);
    throw error;
  }
};

// جلب تقرير المرتب لليوزر العادي
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const user = req.user;

    console.log('GET /api/bonus-reports/me received:', { userCode: user.code, dateFrom, dateTo });

    if (!dateFrom || !dateTo) {
      console.error('Missing dateFrom or dateTo:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية والنهاية مطلوبان' });
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date format:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }
    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    let report = await MonthlyBonusReport.findOne({
      code: user.code,
      dateFrom: startDate.toJSDate(),
      dateTo: endDate.toJSDate(),
    }).populate('createdBy updatedBy', 'fullName');

    if (!report) {
      const dbUser = await User.findOne({ code: user.code });
      if (!dbUser) {
        console.error(`User not found for code ${user.code}`);
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      const attendanceStats = await calculateAttendanceStats(user.code, startDate, endDate);

      report = {
        code: user.code,
        employeeName: dbUser.fullName || 'غير معروف',
        department: dbUser.department || '',
        baseBonus: Number(dbUser.baseBonus || 0),
        bonusPercentage: Number(dbUser.bonusPercentage || 0),
        workDaysPerWeek: Number(dbUser.workDaysPerWeek || 6),
        totalWorkDays: attendanceStats.totalWorkDays,
        absences: attendanceStats.absences,
        annualLeave: attendanceStats.annualLeave,
        medicalLeave: attendanceStats.medicalLeave,
        totalLeaveDays: attendanceStats.totalLeaveDays,
        tieUpValue: 0,
        productionValue: 0,
        advances: Number(dbUser.advances || 0),
        deductions: 0,
        netBonus: Number(
          calculateNetBonus(
            dbUser.baseBonus || 0,
            dbUser.bonusPercentage || 0,
            attendanceStats.absences,
            0,
            0,
            dbUser.advances || 0,
            0
          )
        ),
        dateFrom: startDate.toJSDate(),
        dateTo: endDate.toJSDate(),
        createdBy: user._id,
      };
    }

    console.log(`Fetched report for user ${user.code} from ${dateFrom} to ${dateTo}: netBonus=${report.netBonus}`);
    res.status(200).json({ report });
  } catch (error) {
    console.error('Error fetching user report:', error.message);
    res.status(500).json({ error: 'خطأ في جلب التقرير', details: error.message });
  }
});

// جلب جميع التقارير أو تقرير لموظف معين (للأدمن فقط)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.query;

    console.log('GET /api/bonus-reports received:', { code, dateFrom, dateTo });

    if (!dateFrom || !dateTo) {
      console.error('Missing dateFrom or dateTo:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية والنهاية مطلوبان' });
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date format:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }
    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    let query = {
      dateFrom: startDate.toJSDate(),
      dateTo: endDate.toJSDate(),
    };
    if (code) query.code = code;

    let reports = await MonthlyBonusReport.find(query).populate('createdBy updatedBy', 'fullName');
    if (!reports || reports.length === 0) {
      const users = code
        ? await User.find({ code })
        : await User.find({ status: 'active' });

      if (users.length === 0) {
        console.error('No users found for query:', { code });
        return res.status(404).json({ error: 'لا يوجد مستخدمين مطابقين' });
      }

      reports = await Promise.all(
        users.map(async (user) => {
          const attendanceStats = await calculateAttendanceStats(user.code, startDate, endDate);
          return {
            code: user.code,
            employeeName: user.fullName || 'غير معروف',
            department: user.department || '',
            baseBonus: Number(user.baseBonus || 0),
            bonusPercentage: Number(user.bonusPercentage || 0),
            workDaysPerWeek: Number(user.workDaysPerWeek || 6),
            totalWorkDays: attendanceStats.totalWorkDays,
            absences: attendanceStats.absences,
            annualLeave: attendanceStats.annualLeave,
            medicalLeave: attendanceStats.medicalLeave,
            totalLeaveDays: attendanceStats.totalLeaveDays,
            tieUpValue: 0,
            productionValue: 0,
            advances: Number(user.advances || 0),
            deductions: 0,
            netBonus: Number(
              calculateNetBonus(
                user.baseBonus || 0,
                user.bonusPercentage || 0,
                attendanceStats.absences,
                0,
                0,
                user.advances || 0,
                0
              )
            ),
            dateFrom: startDate.toJSDate(),
            dateTo: endDate.toJSDate(),
            createdBy: req.user._id,
          };
        })
      );
    }

    console.log(`Fetched ${reports.length} reports for query:`, query);
    res.status(200).json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error.message);
    res.status(500).json({ error: 'خطأ في جلب التقارير', details: error.message });
  }
});

// إنشاء تقرير جديد (للأدمن فقط)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo, tieUpValue, productionValue, advances, deductions } = req.body;

    console.log('POST /api/bonus-reports received:', { code, dateFrom, dateTo });

    if (!code || !dateFrom || !dateTo) {
      console.error('Missing required fields:', { code, dateFrom, dateTo });
      return res.status(400).json({ error: 'كود الموظف وتاريخ البداية والنهاية مطلوبة' });
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date format:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }
    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    if (tieUpValue !== undefined && Number(tieUpValue) < 0) {
      console.error('Negative tieUpValue:', tieUpValue);
      return res.status(400).json({ error: 'قيمة التربيط يجب ألا تكون سالبة' });
    }
    if (productionValue !== undefined && Number(productionValue) < 0) {
      console.error('Negative productionValue:', productionValue);
      return res.status(400).json({ error: 'قيمة الإنتاج يجب ألا تكون سالبة' });
    }
    if (advances !== undefined && Number(advances) < 0) {
      console.error('Negative advances:', advances);
      return res.status(400).json({ error: 'السلف يجب ألا تكون سالبة' });
    }
    if (deductions !== undefined && Number(deductions) < 0) {
      console.error('Negative deductions:', deductions);
      return res.status(400).json({ error: 'الاستقطاعات يجب ألا تكون سالبة' });
    }

    const user = await User.findOne({ code });
    if (!user) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // حذف التقرير القديم إذا كان موجودًا
    const existingReport = await MonthlyBonusReport.findOne({
      code,
      dateFrom: startDate.toJSDate(),
      dateTo: endDate.toJSDate(),
    });
    if (existingReport) {
      await MonthlyBonusReport.deleteOne({ _id: existingReport._id });
      console.log(`Deleted existing report for code ${code} from ${dateFrom} to ${dateTo}`);
    }

    const attendanceStats = await calculateAttendanceStats(code, startDate, endDate);

    const report = new MonthlyBonusReport({
      code,
      employeeName: user.fullName || 'غير معروف',
      department: user.department || '',
      baseBonus: Number(user.baseBonus || 0),
      bonusPercentage: Number(user.bonusPercentage || 0),
      workDaysPerWeek: Number(user.workDaysPerWeek || 6),
      totalWorkDays: attendanceStats.totalWorkDays,
      absences: attendanceStats.absences,
      annualLeave: attendanceStats.annualLeave,
      medicalLeave: attendanceStats.medicalLeave,
      totalLeaveDays: attendanceStats.totalLeaveDays,
      tieUpValue: Number(tieUpValue) || 0,
      productionValue: Number(productionValue) || 0,
      advances: Number(advances) || user.advances || 0,
      deductions: Number(deductions) || 0,
      netBonus: Number(
        calculateNetBonus(
          user.baseBonus || 0,
          user.bonusPercentage || 0,
          attendanceStats.absences,
          Number(tieUpValue) || 0,
          Number(productionValue) || 0,
          Number(advances) || user.advances || 0,
          Number(deductions) || 0
        )
      ),
      dateFrom: startDate.toJSDate(),
      dateTo: endDate.toJSDate(),
      createdBy: req.user._id,
    });

    await report.save();
    console.log(`Created report for code ${code} from ${dateFrom} to ${dateTo}: netBonus=${report.netBonus}`);
    res.status(201).json({ message: 'تم حفظ التقرير بنجاح', report });
  } catch (error) {
    console.error('Error saving report:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'تقرير موجود مسبقًا لهذا الموظف في هذه الفترة' });
    }
    res.status(500).json({ error: 'خطأ في حفظ التقرير', details: error.message });
  }
});

// تحديث تقرير (للأدمن فقط)
router.put('/:code', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const { dateFrom, dateTo, tieUpValue, productionValue, advances, deductions } = req.body;

    console.log('PUT /api/bonus-reports/:code received:', { code, dateFrom, dateTo, body: req.body });

    if (!dateFrom || !dateTo) {
      console.error('Missing dateFrom or dateTo:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية والنهاية مطلوبان' });
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date format:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }
    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    if (tieUpValue !== undefined && Number(tieUpValue) < 0) {
      console.error('Negative tieUpValue:', tieUpValue);
      return res.status(400).json({ error: 'قيمة التربيط يجب ألا تكون سالبة' });
    }
    if (productionValue !== undefined && Number(productionValue) < 0) {
      console.error('Negative productionValue:', productionValue);
      return res.status(400).json({ error: 'قيمة الإنتاج يجب ألا تكون سالبة' });
    }
    if (advances !== undefined && Number(advances) < 0) {
      console.error('Negative advances:', advances);
      return res.status(400).json({ error: 'السلف يجب ألا تكون سالبة' });
    }
    if (deductions !== undefined && Number(deductions) < 0) {
      console.error('Negative deductions:', deductions);
      return res.status(400).json({ error: 'الاستقطاعات يجب ألا تكون سالبة' });
    }

    let report = await MonthlyBonusReport.findOne({
      code,
      dateFrom: startDate.toJSDate(),
      dateTo: endDate.toJSDate(),
    });

    const user = await User.findOne({ code });
    if (!user) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const attendanceStats = await calculateAttendanceStats(code, startDate, endDate);

    if (report) {
      // التحقق من زيادة قيمة التربيط والاستقطاعات
      if (tieUpValue !== undefined && Number(tieUpValue) < Number(report.tieUpValue)) {
        console.error(`tieUpValue (${tieUpValue}) is less than current (${report.tieUpValue})`);
        return res.status(400).json({ error: 'قيمة التربيط يجب أن تكون أكبر من أو تساوي القيمة الحالية' });
      }
      if (deductions !== undefined && Number(deductions) < Number(report.deductions)) {
        console.error(`deductions (${deductions}) is less than current (${report.deductions})`);
        return res.status(400).json({ error: 'الاستقطاعات يجب أن تكون أكبر من أو تساوي القيمة الحالية' });
      }

      // تحديث التقرير
      const updatedFields = {
        tieUpValue: tieUpValue !== undefined ? Number(tieUpValue) : report.tieUpValue,
        productionValue: productionValue !== undefined ? Number(productionValue) : report.productionValue,
        advances: advances !== undefined ? Number(advances) : report.advances,
        deductions: deductions !== undefined ? Number(deductions) : report.deductions,
        totalWorkDays: attendanceStats.totalWorkDays,
        absences: attendanceStats.absences,
        annualLeave: attendanceStats.annualLeave,
        medicalLeave: attendanceStats.medicalLeave,
        totalLeaveDays: attendanceStats.totalLeaveDays,
        updatedBy: req.user._id,
        netBonus: Number(
          calculateNetBonus(
            report.baseBonus,
            report.bonusPercentage,
            attendanceStats.absences,
            tieUpValue !== undefined ? Number(tieUpValue) : report.tieUpValue,
            productionValue !== undefined ? Number(productionValue) : report.productionValue,
            advances !== undefined ? Number(advances) : report.advances,
            deductions !== undefined ? Number(deductions) : report.deductions
          )
        ),
      };

      const updatedReport = await MonthlyBonusReport.findOneAndUpdate(
        {
          code,
          dateFrom: startDate.toJSDate(),
          dateTo: endDate.toJSDate(),
        },
        { $set: updatedFields },
        { new: true }
      );

      if (!updatedReport) {
        console.error(`Failed to update report for code ${code} from ${dateFrom} to ${dateTo}`);
        return res.status(404).json({ error: 'التقرير غير موجود' });
      }

      console.log(`Updated report for code ${code} from ${dateFrom} to ${dateTo}: netBonus=${updatedReport.netBonus}`);
      return res.status(200).json({ message: 'تم تحديث التقرير بنجاح', report: updatedReport });
    } else {
      // إنشاء تقرير جديد إذا لم يكن موجودًا
      console.log(`Report not found for code ${code} from ${dateFrom} to ${dateTo}, creating new report`);

      const report = new MonthlyBonusReport({
        code,
        employeeName: user.fullName || 'غير معروف',
        department: user.department || '',
        baseBonus: Number(user.baseBonus || 0),
        bonusPercentage: Number(user.bonusPercentage || 0),
        workDaysPerWeek: Number(user.workDaysPerWeek || 6),
        totalWorkDays: attendanceStats.totalWorkDays,
        absences: attendanceStats.absences,
        annualLeave: attendanceStats.annualLeave,
        medicalLeave: attendanceStats.medicalLeave,
        totalLeaveDays: attendanceStats.totalLeaveDays,
        tieUpValue: Number(tieUpValue) || 0,
        productionValue: Number(productionValue) || 0,
        advances: Number(advances) || user.advances || 0,
        deductions: Number(deductions) || 0,
        netBonus: Number(
          calculateNetBonus(
            user.baseBonus || 0,
            user.bonusPercentage || 0,
            attendanceStats.absences,
            Number(tieUpValue) || 0,
            Number(productionValue) || 0,
            Number(advances) || user.advances || 0,
            Number(deductions) || 0
          )
        ),
        dateFrom: startDate.toJSDate(),
        dateTo: endDate.toJSDate(),
        createdBy: req.user._id,
      });

      await report.save();
      console.log(`Created report for code ${code} from ${dateFrom} to ${dateTo}: netBonus=${report.netBonus}`);
      return res.status(201).json({ message: 'تم إنشاء التقرير بنجاح', report });
    }
  } catch (error) {
    console.error('Error updating/creating report:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'تقرير موجود مسبقًا لهذا الموظف في هذه الفترة' });
    }
    return res.status(500).json({ error: 'خطأ في تحديث أو إنشاء التقرير', details: error.message });
  }
});

// دالة موحدة لحساب صافي المكافأة (مأخوذة من MonthlyBonusReport.js)
const calculateNetBonus = (baseBonus, bonusPercentage, absences, tieUpValue, productionValue, advances, deductions) => {
  const bonus = Number(baseBonus || 0) * (Number(bonusPercentage || 0) / 100);
  const dailyBonus = bonus / 30;
  const absenceDeduction = Number(absences || 0) * dailyBonus;
  const adjustedBonus = bonus - absenceDeduction;
  const netBonus = adjustedBonus + Number(tieUpValue || 0) + Number(productionValue || 0) - Number(advances || 0) - Number(deductions || 0);
  return Math.max(0, Number(netBonus.toFixed(2)));
};

export { router as default, authMiddleware, adminMiddleware };
