import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Fingerprint from '../models/Fingerprint.js';
import MonthlyBonusReport from '../models/MonthlyBonusReport.js';
import User from '../models/User.js';
import { parseFingerprintFile } from '../utils/fingerprintParser.js';
import { DateTime } from 'luxon';
const router = express.Router();
import cron from 'node-cron';

// إعادة تعيين بدل التأخير الشهري في بداية كل شهر
cron.schedule('0 0 1 * *', async () => {
  try {
    await User.updateMany({}, { $set: { monthlyLateAllowance: 120 } });
    console.log('Reset monthlyLateAllowance to 120 for all users');
  } catch (error) {
    console.error('Error resetting monthlyLateAllowance:', error.message);
  }
});
// إعداد دليل التخزين
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../Uploads');

// التأكد من وجود الدليل
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد multer لتخزين الملفات على القرص
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});



// فلتر للتأكد من أن الملفات هي Excel فقط
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
  }
};

// إعداد multer
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// التحقق من التوكن وصلاحية الأدمن
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.error('No token provided in request');
    return res.status(401).json({ message: 'غير مصرح' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // تخزين بيانات المستخدم في الطلب
    next();
  } catch (error) {
    console.error('Invalid token:', error.message);
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
};
// التحقق مما إذا كان اليوم إجازة أسبوعية
const isWeeklyLeaveDay = (date, workDaysPerWeek) => {
  const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
  return (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
         (workDaysPerWeek === 6 && dayOfWeek === 5);
};

// حساب أيام الإجازة الأسبوعية في نطاق زمني
const calculateWeeklyLeaveDays = (startDate, endDate, workDaysPerWeek) => {
  let currentDate = DateTime.fromISO(startDate, { zone: 'Africa/Cairo' });
  const end = DateTime.fromISO(endDate, { zone: 'Africa/Cairo' });
  let weeklyLeaveDays = 0;

  while (currentDate <= end) {
    if (isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek)) {
      weeklyLeaveDays++;
    }
    currentDate = currentDate.plus({ days: 1 });
  }
  return weeklyLeaveDays;
};

// حساب أيام العمل في نطاق زمني
const calculateWorkDaysInRange = (startDate, endDate, workDaysPerWeek) => {
  let currentDate = DateTime.fromISO(startDate, { zone: 'Africa/Cairo' });
  const end = DateTime.fromISO(endDate, { zone: 'Africa/Cairo' });
  let workDays = 0;

  while (currentDate <= end) {
    if (!isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek)) {
      workDays++;
    }
    currentDate = currentDate.plus({ days: 1 });
  }
  return workDays;
};

// معالجة خصومات التأخير

async function handleLateDeduction(report) {
  try {
    const user = await User.findOne({ code: report.code });
    let monthlyLateAllowance = user ? user.monthlyLateAllowance : 120;

    // تجاهل الخصم إذا كان هناك إجازة أو يوم عطلة أسبوعية
    if (
      report.annualLeave ||
      report.medicalLeave ||
      report.officialLeave ||
      report.leaveCompensation ||
      isWeeklyLeaveDay(report.date, user ? user.workDaysPerWeek : 6)
    ) {
      report.lateMinutes = 0;
      report.lateDeduction = 0;
      return;
    }

    if (report.checkIn) {
      const checkInTime = DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' });
      if (!checkInTime.isValid) {
        console.warn(`Invalid checkIn time for report ${report._id} on ${DateTime.fromJSDate(report.date).toISODate()}`);
        report.lateMinutes = 0;
        report.lateDeduction = 0;
        return;
      }

      const expectedStartTime = checkInTime.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
      const lateLimit = checkInTime.set({ hour: 9, minute: 16, second: 0, millisecond: 0 });
      const lateThreshold = checkInTime.set({ hour: 11, minute: 0, second: 0, millisecond: 0 });

      const diffMs = checkInTime.toMillis() - expectedStartTime.toMillis();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes > 45) { // التأخير بعد 9:16 صباحًا
        if (monthlyLateAllowance >= 46) {
          monthlyLateAllowance -= 46;
          report.lateMinutes = diffMinutes;
          report.lateDeduction = 0;
          if (user) {
            user.monthlyLateAllowance = monthlyLateAllowance;
            await user.save();
            console.log(`Deducted 46 minutes from monthlyLateAllowance for ${report.code}. New allowance: ${monthlyLateAllowance}`);
          }
        } else {
          report.lateMinutes = diffMinutes;
          if (checkInTime.toMillis() >= lateThreshold.toMillis()) {
            report.lateDeduction = 0.5; // خصم 1/2 يوم بعد 11:00
            console.log(`Late deduction for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: 0.5 (threshold exceeded)`);
          } else {
            report.lateDeduction = 0.25; // خصم 1/4 يوم بين 9:16 و11:00
            console.log(`Late deduction for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: 0.25 (late limit exceeded)`);
          }
          if (user) {
            user.monthlyLateAllowance = 0;
            await user.save();
            console.log(`Set monthlyLateAllowance to 0 for ${report.code} due to insufficient allowance`);
          }
        }
      } else {
        report.lateMinutes = diffMinutes > 0 ? diffMinutes : 0;
        report.lateDeduction = 0;
      }
    } else {
      report.lateMinutes = 0;
      report.lateDeduction = 0;
    }
  } catch (error) {
    console.error(`Error in handleLateDeduction for code ${report.code}:`, error.message);
    report.lateMinutes = 0;
    report.lateDeduction = 0;
  }
}


async function handleEarlyLeaveDeduction(report) {
  try {
    const user = await User.findOne({ code: report.code });
    if (
      report.leaveCompensation ||
      report.annualLeave ||
      report.medicalLeave ||
      report.officialLeave ||
      isWeeklyLeaveDay(report.date, user ? user.workDaysPerWeek : 6)
    ) {
      report.earlyLeaveDeduction = 0;
      console.log(`No early leave deduction for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: leave or weekly day`);
      return;
    }

    if (report.checkOut) {
      const checkOutTime = DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' });
      if (!checkOutTime.isValid) {
        console.warn(`Invalid checkOut time for report ${report._id} on ${DateTime.fromJSDate(report.date).toISODate()}`);
        report.earlyLeaveDeduction = 0;
        return;
      }

      const earlyThreshold = checkOutTime.set({ hour: 16, minute: 0, second: 0, millisecond: 0 });
      const leaveLimit = checkOutTime.set({ hour: 17, minute: 15, second: 0, millisecond: 0 });

      if (checkOutTime.toMillis() <= earlyThreshold.toMillis()) {
        report.earlyLeaveDeduction = 0.5; // خصم 1/2 يوم قبل 4:00 مساءً
        console.log(`Early leave deduction for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: 0.5`);
      } else if (checkOutTime.toMillis() <= leaveLimit.toMillis()) {
        report.earlyLeaveDeduction = 0.25; // خصم 1/4 يوم بين 4:01 و5:15 مساءً
        console.log(`Early leave deduction for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: 0.25`);
      } else {
        report.earlyLeaveDeduction = 0;
      }
    } else if (!report.checkIn) {
      // إذا لم يكن هناك checkIn ولا checkOut، سجل غياب
      report.earlyLeaveDeduction = 1;
      report.absence = true;
      report.workHours = 0;
      console.log(`Absence recorded for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: earlyLeaveDeduction=1, workHours=0`);
    } else {
      // إذا كان هناك checkIn فقط (بصمة واحدة)
      report.workHours = 9; // افتراض 9 ساعات عمل
      report.isSingleFingerprint = true;
      report.earlyLeaveDeduction = 0;
      console.log(`Single fingerprint recorded for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}: workHours=9`);
    }
  } catch (error) {
    console.error(`Error in handleEarlyLeaveDeduction for code ${report.code}:`, error.message);
    report.earlyLeaveDeduction = 0;
  }
}





router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ message: 'لم يتم رفع ملف' });
    }

    console.log(`File uploaded: ${file.path}, Size: ${file.size} bytes`);
    let reports = await parseFingerprintFile(file);
    if (!reports || reports.length === 0) {
      console.error('No valid reports parsed from file');
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'لا توجد بيانات صالحة في الملف' });
    }

    const finalReports = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const dates = reports.map(report => DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }));
    const startDate = DateTime.min(...dates);
    const endDate = DateTime.max(...dates);

    const uniqueCodes = [...new Set(reports.map(report => report.code))];
    const users = await User.find({ code: { $in: uniqueCodes } });

    for (const user of users) {
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const existingReport = reports.find(
          r => r.code === user.code && DateTime.fromJSDate(r.date).toISODate() === dateStr
        );

        let fingerprint;
        if (existingReport) {
          const date = DateTime.fromJSDate(existingReport.date, { zone: 'Africa/Cairo' });
          if (!date.isValid) {
            console.warn(`Skipping report with invalid date for code ${existingReport.code}: ${existingReport.date}`);
            skippedCount++;
            currentDate = currentDate.plus({ days: 1 });
            continue;
          }

          const dbReport = await Fingerprint.findOne({
            code: existingReport.code,
            date: {
              $gte: date.startOf('day').toJSDate(),
              $lte: date.endOf('day').toJSDate(),
            },
          });

          if (dbReport) {
            console.log(`Updating existing report for code ${existingReport.code} on ${date.toISODate()}`);
            fingerprint = dbReport;
            if (!fingerprint.annualLeave) {
              fingerprint.checkIn = existingReport.checkIn || dbReport.checkIn;
              fingerprint.checkOut = existingReport.checkOut || dbReport.checkOut;
              fingerprint.workDaysPerWeek = user.workDaysPerWeek || 6;
              fingerprint.employeeName = user.fullName || 'غير معروف';
              fingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
              fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
              fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
              fingerprint.advances = user.advances || 0;
              fingerprint.annualLeave = false;
              fingerprint.medicalLeave = false;
              fingerprint.officialLeave = false;
              fingerprint.leaveCompensation = 0;
              fingerprint.medicalLeaveDeduction = 0;
              fingerprint.appropriateValue = existingReport.appropriateValue || dbReport.appropriateValue || 0;
              fingerprint.appropriateValueDays = existingReport.appropriateValue ? 1 : dbReport.appropriateValueDays || 0;
              fingerprint.isSingleFingerprint = (fingerprint.checkIn && !fingerprint.checkOut) || (!fingerprint.checkIn && fingerprint.checkOut);
              await fingerprint.calculateAttendance();
              await handleLateDeduction(fingerprint);
              await handleEarlyLeaveDeduction(fingerprint);
            } else {
              console.log(`Skipping update for code ${existingReport.code} on ${date.toISODate()} due to existing annual leave`);
              skippedCount++;
            }
            await fingerprint.save();
            updatedCount++;
          } else {
            fingerprint = new Fingerprint({
              ...existingReport,
              workDaysPerWeek: user.workDaysPerWeek || 6,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: existingReport.appropriateValue || 0,
              appropriateValueDays: existingReport.appropriateValue ? 1 : 0,
              isSingleFingerprint: (existingReport.checkIn && !existingReport.checkOut) || (!existingReport.checkIn && existingReport.checkOut),
            });
            await fingerprint.calculateAttendance();
            await handleLateDeduction(fingerprint);
            await handleEarlyLeaveDeduction(fingerprint);
            await fingerprint.save();
            createdCount++;
          }
        } else {
          const workDaysPerWeek = user.workDaysPerWeek || 6;
          const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

          const existingReportInDB = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          if (!existingReportInDB) {
            const reportData = {
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: isWeekly ? 0 : 1,
              absence: isWeekly ? false : true,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            };

            console.log(`Creating missing report for ${user.code} on ${dateStr} (Weekly: ${isWeekly})`);
            fingerprint = new Fingerprint(reportData);
            await fingerprint.calculateAttendance();
            await handleLateDeduction(fingerprint);
            await handleEarlyLeaveDeduction(fingerprint);
            await fingerprint.save();
            createdCount++;
          }
        }

        if (fingerprint) {
          finalReports.push({
            ...fingerprint.toObject(),
            employeeName: user.fullName || 'غير معروف',
            workDaysPerWeek: fingerprint.workDaysPerWeek,
            monthlyLateAllowance: user.monthlyLateAllowance || 120,
            customAnnualLeave: user.customAnnualLeave || 0,
            annualLeaveBalance: user.annualLeaveBalance || 21,
            advances: user.advances || 0,
            weeklyLeaveDays: isWeeklyLeaveDay(fingerprint.date, fingerprint.workDaysPerWeek) ? 1 : 0,
            annualLeaveDays: fingerprint.annualLeave ? 1 : 0,
            medicalLeaveDays: fingerprint.medicalLeave ? 1 : 0,
            officialLeaveDays: fingerprint.officialLeave ? 1 : 0,
            leaveCompensationDays: fingerprint.leaveCompensation ? 1 : 0,
            appropriateValueDays: fingerprint.appropriateValue ? 1 : 0,
            annualLeave: fingerprint.annualLeave ? 'نعم' : 'لا',
            medicalLeave: fingerprint.medicalLeave ? 'نعم' : 'لا',
            officialLeave: fingerprint.officialLeave ? 'نعم' : 'لا',
            leaveCompensation: fingerprint.leaveCompensation ? parseFloat(fingerprint.leaveCompensation).toFixed(2) : 'لا',
            appropriateValue: fingerprint.appropriateValue ? parseFloat(fingerprint.appropriateValue).toFixed(2) : 'لا',
            absence: fingerprint.absence ? 'نعم' : 'لا',
            isSingleFingerprint: fingerprint.isSingleFingerprint ? 'نعم' : '',
            checkIn: fingerprint.checkIn ? DateTime.fromJSDate(fingerprint.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
            checkOut: fingerprint.checkOut ? DateTime.fromJSDate(fingerprint.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
            date: DateTime.fromJSDate(fingerprint.date, { zone: 'Africa/Cairo' }).toISODate(),
          });
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }

    const uniqueReports = [];
    const seen = new Set();
    for (const report of finalReports) {
      const key = `${report.code}-${report.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueReports.push(report);
      } else {
        console.log(`Removing duplicate report for ${report.code} on ${report.date}`);
        await Fingerprint.deleteOne({
          code: report.code,
          date: DateTime.fromISO(report.date, { zone: 'Africa/Cairo' }).toJSDate(),
        });
      }
    }

    try {
      fs.unlinkSync(file.path);
      console.log(`Deleted temporary file: ${file.path}`);
    } catch (err) {
      console.error(`Error deleting file ${file.path}:`, err.message);
    }

    console.log(`Upload completed: ${createdCount} records created, ${updatedCount} records updated, ${skippedCount} records skipped`);
    res.json({
      message: 'تم رفع الملف ومعالجة البيانات بنجاح',
      createdCount,
      updatedCount,
      skippedCount,
      reports: uniqueReports,
    });
  } catch (error) {
    console.error('Error in upload route:', error.message);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`Deleted temporary file due to error: ${req.file.path}`);
      } catch (err) {
        console.error(`Error deleting file ${req.file.path}:`, err.message);
      }
    }
    res.status(500).json({ message: 'خطأ في معالجة الملف', error: error.message });
  }
});





// مسار رفع الملف
// إنشاء/تحديث سجل بصمة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { code, date, checkIn, checkOut, absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue } = req.body;

    const dateDt = DateTime.fromISO(date, { zone: 'Africa/Cairo' });
    if (!dateDt.isValid) {
      console.error('Invalid date format:', date);
      return res.status(400).json({ error: 'تاريخ السجل غير صالح' });
    }

    if ([absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue].filter(Boolean).length > 1) {
      console.error('Multiple status flags set for code:', code, { absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue });
      return res.status(400).json({ error: 'لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة، قيمة مناسبة)' });
    }

    const user = await User.findOne({ code });
    if (!user) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'لم يتم العثور على المستخدم' });
    }

    if (annualLeave && user.annualLeaveBalance <= 0) {
      console.error(`Insufficient annual leave balance for code ${code}`);
      return res.status(400).json({ error: 'رصيد الإجازة السنوية غير كافٍ' });
    }

    const existingReport = await Fingerprint.findOne({
      code,
      date: {
        $gte: dateDt.startOf('day').toJSDate(),
        $lte: dateDt.endOf('day').toJSDate(),
      },
    });

    let fingerprint;
    const advances = user.advances || 0;

    if (existingReport) {
      console.log(`Updating existing report for code ${code} on ${dateDt.toISODate()}`);
      fingerprint = existingReport;
      fingerprint.checkIn = checkIn ? DateTime.fromISO(checkIn, { zone: 'Africa/Cairo' }).toJSDate() : fingerprint.checkIn;
      fingerprint.checkOut = checkOut ? DateTime.fromISO(checkOut, { zone: 'Africa/Cairo' }).toJSDate() : fingerprint.checkOut;
      fingerprint.absence = absence !== undefined ? absence : fingerprint.absence;
      fingerprint.annualLeave = annualLeave !== undefined ? annualLeave : fingerprint.annualLeave;
      fingerprint.medicalLeave = medicalLeave !== undefined ? medicalLeave : fingerprint.medicalLeave;
      fingerprint.officialLeave = officialLeave !== undefined ? officialLeave : fingerprint.officialLeave;
      fingerprint.leaveCompensation = leaveCompensation !== undefined ? (leaveCompensation ? (user.baseSalary / 30 * 2).toFixed(2) : 0) : fingerprint.leaveCompensation;
      fingerprint.appropriateValue = appropriateValue !== undefined ? appropriateValue : fingerprint.appropriateValue || 0;
      fingerprint.appropriateValueDays = appropriateValue !== undefined ? (appropriateValue ? 1 : 0) : fingerprint.appropriateValueDays || 0;
      fingerprint.isSingleFingerprint = (fingerprint.checkIn && !fingerprint.checkOut) || (!fingerprint.checkIn && fingerprint.checkOut);
    } else {
      fingerprint = new Fingerprint({
        code,
        date: dateDt.toJSDate(),
        checkIn: checkIn ? DateTime.fromISO(checkIn, { zone: 'Africa/Cairo' }).toJSDate() : null,
        checkOut: checkOut ? DateTime.fromISO(checkOut, { zone: 'Africa/Cairo' }).toJSDate() : null,
        absence: absence || false,
        annualLeave: annualLeave || false,
        medicalLeave: medicalLeave || false,
        officialLeave: officialLeave || false,
        leaveCompensation: leaveCompensation ? (user.baseSalary / 30 * 2).toFixed(2) : 0,
        appropriateValue: appropriateValue || 0,
        appropriateValueDays: appropriateValue ? 1 : 0,
        workDaysPerWeek: user.workDaysPerWeek || 6,
        employeeName: user.fullName || 'غير معروف',
        monthlyLateAllowance: user.monthlyLateAllowance || 120,
        customAnnualLeave: user.customAnnualLeave || 0,
        annualLeaveBalance: user.annualLeaveBalance || 21,
        advances: advances,
        isSingleFingerprint: (checkIn && !checkOut) || (!checkIn && checkOut),
      });
    }

    if (fingerprint.annualLeave && !existingReport?.annualLeave) {
      user.annualLeaveBalance = (user.annualLeaveBalance || 21) - 1;
      await user.save();
      console.log(`Deducted 1 day from annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    } else if (!fingerprint.annualLeave && existingReport?.annualLeave) {
      user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
      await user.save();
      console.log(`Restored 1 day to annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    }

    if (!fingerprint.checkIn && !fingerprint.checkOut && !fingerprint.annualLeave && !fingerprint.medicalLeave && !fingerprint.officialLeave && !fingerprint.leaveCompensation) {
      fingerprint.absence = true;
      fingerprint.workHours = 0;
    }

    await fingerprint.calculateAttendance();
    await handleLateDeduction(fingerprint);
    await handleEarlyLeaveDeduction(fingerprint);

    fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;

    try {
      await fingerprint.save();
      console.log(`Saved fingerprint for code ${fingerprint.code} on ${dateDt.toISODate()}`);
    } catch (saveError) {
      console.error(`Failed to save fingerprint for code ${fingerprint.code}:`, saveError.message);
      return res.status(500).json({ error: 'خطأ في حفظ السجل', details: saveError.message });
    }

    const responseReport = {
      ...fingerprint.toObject(),
      employeeName: user.fullName || 'غير معروف',
      workDaysPerWeek: user.workDaysPerWeek || 6,
      monthlyLateAllowance: user.monthlyLateAllowance || 120,
      customAnnualLeave: user.customAnnualLeave || 0,
      annualLeaveBalance: user.annualLeaveBalance || 21,
      advances: advances,
      weeklyLeaveDays: isWeeklyLeaveDay(fingerprint.date, user.workDaysPerWeek) ? 1 : 0,
      annualLeaveDays: fingerprint.annualLeave ? 1 : 0,
      medicalLeaveDays: fingerprint.medicalLeave ? 1 : 0,
      officialLeaveDays: fingerprint.officialLeave ? 1 : 0,
      leaveCompensationDays: fingerprint.leaveCompensation ? 1 : 0,
      appropriateValueDays: fingerprint.appropriateValue ? 1 : 0,
      checkIn: fingerprint.checkIn ? DateTime.fromJSDate(fingerprint.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
      checkOut: fingerprint.checkOut ? DateTime.fromJSDate(fingerprint.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
      date: DateTime.fromJSDate(fingerprint.date, { zone: 'Africa/Cairo' }).toISODate(),
      absence: fingerprint.absence ? 'نعم' : 'لا',
      annualLeave: fingerprint.annualLeave ? 'نعم' : 'لا',
      medicalLeave: fingerprint.medicalLeave ? 'نعم' : 'لا',
      officialLeave: fingerprint.officialLeave ? 'نعم' : 'لا',
      leaveCompensation: fingerprint.leaveCompensation ? parseFloat(fingerprint.leaveCompensation).toFixed(2) : 'لا',
      appropriateValue: fingerprint.appropriateValue ? parseFloat(fingerprint.appropriateValue).toFixed(2) : 'لا',
      isSingleFingerprint: fingerprint.isSingleFingerprint ? 'نعم' : '',
    };

    res.status(existingReport ? 200 : 201).json({
      message: existingReport ? 'تم تحديث السجل بنجاح' : 'تم إنشاء السجل بنجاح',
      report: responseReport,
    });
  } catch (err) {
    console.error('Error creating fingerprint:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'خطأ في إنشاء/تحديث السجل', details: err.message });
  }
});

// تقرير المرتب الشهري


router.get('/', authMiddleware, async (req, res) => {
  const { code, dateFrom, dateTo } = req.query;

  try {
    const query = {};

    // إذا كان المستخدم ليس أدمن، يجب أن يرى بياناته فقط
    if (req.user.role !== 'admin') {
      if (code && code !== req.user.code) {
        console.error(`User ${req.user.code} attempted to access data for code ${code}`);
        return res.status(403).json({ message: 'غير مصرح لعرض بيانات مستخدم آخر' });
      }
      query.code = req.user.code; // تقييد البحث بكود المستخدم
    } else if (code) {
      query.code = code; // الأدمن يمكنه البحث بكود معين
    }

    let reports = [];
    let users = [];

    if (dateFrom && dateTo) {
      const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
      const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

      if (!startDate.isValid || !endDate.isValid) {
        console.error('Invalid date range:', { dateFrom, dateTo });
        return res.status(400).json({ message: 'تاريخ البداية أو النهاية غير صالح' });
      }

      if (startDate > endDate) {
        console.error('Start date is after end date:', { dateFrom, dateTo });
        return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
      }

      query.date = { $gte: startDate.toJSDate(), $lte: endDate.toJSDate() };
      reports = await Fingerprint.find(query).sort({ date: 1 });

      // جلب المستخدمين بناءً على دور المستخدم
      users = req.user.role === 'admin' && code ? await User.find({ code }) : await User.find({ code: query.code || { $exists: true } });
      if (code && users.length === 0) {
        return res.status(404).json({ message: `لا يوجد مستخدم بالكود ${code}` });
      }

      const missingReports = [];
      for (let user of users) {
        let currentDate = startDate;
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISODate();
          const existingReport = reports.find(
            r => r.code === user.code && DateTime.fromJSDate(r.date).toISODate() === dateStr
          );

          if (!existingReport) {
            const workDaysPerWeek = user.workDaysPerWeek || 6;
            const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);
            const reportData = {
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: isWeekly ? 0 : 1,
              absence: isWeekly ? false : true,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            };

            const existingReportInDB = await Fingerprint.findOne({
              code: user.code,
              date: {
                $gte: currentDate.startOf('day').toJSDate(),
                $lte: currentDate.endOf('day').toJSDate(),
              },
            });

            if (!existingReportInDB) {
              console.log(`Creating report for ${user.code} on ${dateStr} (Weekly: ${isWeekly})`);
              const fingerprint = new Fingerprint(reportData);
              await fingerprint.calculateAttendance();
              await handleLateDeduction(fingerprint);
              await handleEarlyLeaveDeduction(fingerprint);
              await fingerprint.save();
              missingReports.push(fingerprint);
            }
          } else {
            existingReport.employeeName = user.fullName || 'غير معروف';
            existingReport.monthlyLateAllowance = user.monthlyLateAllowance || 120;
            existingReport.customAnnualLeave = user.customAnnualLeave || 0;
            existingReport.annualLeaveBalance = user.annualLeaveBalance || 21;
            existingReport.advances = user.advances || 0;
            existingReport.appropriateValue = existingReport.appropriateValue || 0;
            existingReport.appropriateValueDays = existingReport.appropriateValue ? 1 : 0;
            await existingReport.calculateAttendance();
            await handleLateDeduction(existingReport);
            await handleEarlyLeaveDeduction(existingReport);
            await existingReport.save();
          }
          currentDate = currentDate.plus({ days: 1 });
        }
      }

      reports = [...reports, ...missingReports].sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
      reports = await Fingerprint.find(query).sort({ date: 1 });
      users = req.user.role === 'admin' && code ? await User.find({ code }) : await User.find({ code: query.code || { $exists: true } });
    }

    // إزالة التكرارات
    const uniqueReports = [];
    const seen = new Set();
    for (const report of reports) {
      const key = `${report.code}-${DateTime.fromJSDate(report.date).toISODate()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueReports.push(report);
      } else {
        console.log(`Removing duplicate report for ${report.code} on ${DateTime.fromJSDate(report.date).toISODate()}`);
        await Fingerprint.deleteOne({ _id: report._id });
      }
    }

    const responseReports = await Promise.all(
      uniqueReports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          monthlyLateAllowance: user ? user.monthlyLateAllowance : 120,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation ? 1 : 0,
          appropriateValueDays: report.appropriateValue ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : '',
        };
      })
    );

    const totalWeeklyLeaveDays = dateFrom && dateTo
      ? calculateWeeklyLeaveDays(dateFrom, dateTo, responseReports[0]?.workDaysPerWeek || 6)
      : 0;
    const totalAnnualLeaveDays = responseReports.reduce((acc, report) => acc + (report.annualLeaveDays || 0), 0);
    const totalMedicalLeaveDays = responseReports.reduce((acc, report) => acc + (report.medicalLeaveDays || 0), 0);
    const totalOfficialLeaveDays = responseReports.reduce((acc, report) => acc + (report.officialLeaveDays || 0), 0);
    const totalLeaveCompensationDays = responseReports.reduce((acc, report) => acc + (report.leaveCompensationDays || 0), 0);
    const totalAppropriateValueDays = responseReports.reduce((acc, report) => acc + (report.appropriateValueDays || 0), 0);
    const totalAbsenceDays = responseReports.reduce((acc, report) => acc + (report.absence === 'نعم' ? 1 : 0), 0);
    const totalLateDays = responseReports.reduce((acc, report) => acc + (report.lateDeduction > 0 ? 1 : 0), 0);
    const totalAppropriateValue = responseReports.reduce((acc, report) => acc + (report.appropriateValue ? parseFloat(report.appropriateValue) : 0), 0);

    res.json({
      reports: responseReports,
      totalWeeklyLeaveDays,
      totalAnnualLeaveDays,
      totalMedicalLeaveDays,
      totalOfficialLeaveDays,
      totalLeaveCompensationDays,
      totalAppropriateValueDays,
      totalAppropriateValue: totalAppropriateValue.toFixed(2),
      totalAbsenceDays,
      totalLateDays,
    });
  } catch (error) {
	  A
    console.error('Error in search route:', error.message);
    res.status(500).json({ message: 'خطأ في البحث', error: error.message });
  }
});


// تقرير المرتب الشهري
// نقطة النهاية لتحديث سجل بصمة


router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const fingerprint = await Fingerprint.findById(req.params.id);
    if (!fingerprint) {
      console.error(`Fingerprint not found for ID ${req.params.id}`);
      return res.status(404).json({ error: 'السجل غير موجود' });
    }

    const { code, date, checkIn, checkOut, absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue } = req.body;

    if ([absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue].filter(Boolean).length > 1) {
      console.error('Multiple status flags set:', { absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue });
      return res.status(400).json({ error: 'لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة، قيمة مناسبة)' });
    }

    const dateDt = DateTime.fromISO(date, { zone: 'Africa/Cairo' });
    if (!dateDt.isValid) {
      console.error('Invalid date format:', date);
      return res.status(400).json({ error: 'تاريخ السجل غير صالح' });
    }

    const user = await User.findOne({ code: code || fingerprint.code });
    if (!user) {
      console.error(`User not found for code ${code || fingerprint.code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (annualLeave && !fingerprint.annualLeave && user.annualLeaveBalance <= 0) {
      console.error(`Insufficient annual leave balance for code ${code || fingerprint.code}`);
      return res.status(400).json({ error: 'رصيد الإجازة السنوية غير كافٍ' });
    }

    const existingReport = await Fingerprint.findOne({
      code: code || fingerprint.code,
      date: {
        $gte: dateDt.startOf('day').toJSDate(),
        $lte: dateDt.endOf('day').toJSDate(),
      },
      _id: { $ne: req.params.id },
    });

    let targetFingerprint = fingerprint;
    if (existingReport) {
      console.log(`Found duplicate report for code ${code || fingerprint.code} on ${dateDt.toISODate()}, merging...`);
      targetFingerprint = existingReport;
      await Fingerprint.deleteOne({ _id: req.params.id });
    }

    targetFingerprint.code = code || fingerprint.code;
    targetFingerprint.date = dateDt.toJSDate();
    targetFingerprint.checkIn = (annualLeave || medicalLeave || officialLeave || leaveCompensation || absence)
      ? null
      : (checkIn ? DateTime.fromISO(checkIn, { zone: 'Africa/Cairo' }).toJSDate() : fingerprint.checkIn);
    targetFingerprint.checkOut = (annualLeave || medicalLeave || officialLeave || leaveCompensation || absence)
      ? null
      : (checkOut ? DateTime.fromISO(checkOut, { zone: 'Africa/Cairo' }).toJSDate() : fingerprint.checkOut);
    targetFingerprint.absence = absence !== undefined ? absence : fingerprint.absence;
    targetFingerprint.annualLeave = annualLeave !== undefined ? annualLeave : fingerprint.annualLeave;
    targetFingerprint.medicalLeave = medicalLeave !== undefined ? medicalLeave : fingerprint.medicalLeave;
    targetFingerprint.officialLeave = officialLeave !== undefined ? officialLeave : fingerprint.officialLeave;
    targetFingerprint.leaveCompensation = leaveCompensation !== undefined
      ? (leaveCompensation ? (user.baseSalary / 30 * 2).toFixed(2) : 0)
      : fingerprint.leaveCompensation;
    targetFingerprint.appropriateValue = appropriateValue !== undefined ? appropriateValue : fingerprint.appropriateValue || 0;
    targetFingerprint.appropriateValueDays = appropriateValue !== undefined ? (appropriateValue ? 1 : 0) : fingerprint.appropriateValueDays || 0;
    targetFingerprint.employeeName = user.fullName || 'غير معروف';
    targetFingerprint.workDaysPerWeek = user.workDaysPerWeek || 6;
    targetFingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
    targetFingerprint.customAnnualLeave = user.customAnnualLeave || 0;
    targetFingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
    targetFingerprint.advances = user.advances || 0;
    targetFingerprint.isSingleFingerprint = (targetFingerprint.checkIn && !targetFingerprint.checkOut) || (!targetFingerprint.checkIn && targetFingerprint.checkOut);

    if (!targetFingerprint.checkIn && !targetFingerprint.checkOut && !targetFingerprint.annualLeave && !targetFingerprint.medicalLeave && !targetFingerprint.officialLeave && !targetFingerprint.leaveCompensation) {
      targetFingerprint.absence = true;
      targetFingerprint.workHours = 0;
    }

    if (targetFingerprint.annualLeave && !fingerprint.annualLeave) {
      user.annualLeaveBalance -= 1;
      await user.save();
      console.log(`Deducted 1 day from annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    } else if (!targetFingerprint.annualLeave && fingerprint.annualLeave) {
      user.annualLeaveBalance += 1;
      await user.save();
      console.log(`Restored 1 day to annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    }

    await targetFingerprint.calculateAttendance();
    await handleLateDeduction(targetFingerprint);
    await handleEarlyLeaveDeduction(targetFingerprint);

    await targetFingerprint.save();

    const responseReport = {
      ...targetFingerprint.toObject(),
      employeeName: user.fullName || 'غير معروف',
      workDaysPerWeek: user.workDaysPerWeek || 6,
      monthlyLateAllowance: user.monthlyLateAllowance || 120,
      customAnnualLeave: user.customAnnualLeave || 0,
      annualLeaveBalance: user.annualLeaveBalance || 21,
      advances: user.advances || 0,
      weeklyLeaveDays: isWeeklyLeaveDay(targetFingerprint.date, user.workDaysPerWeek) ? 1 : 0,
      annualLeaveDays: targetFingerprint.annualLeave ? 1 : 0,
      medicalLeaveDays: targetFingerprint.medicalLeave ? 1 : 0,
      officialLeaveDays: targetFingerprint.officialLeave ? 1 : 0,
      leaveCompensationDays: targetFingerprint.leaveCompensation ? 1 : 0,
      appropriateValueDays: targetFingerprint.appropriateValue ? 1 : 0,
      checkIn: targetFingerprint.checkIn
        ? DateTime.fromJSDate(targetFingerprint.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a')
        : null,
      checkOut: targetFingerprint.checkOut
        ? DateTime.fromJSDate(targetFingerprint.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a')
        : null,
      date: DateTime.fromJSDate(targetFingerprint.date, { zone: 'Africa/Cairo' }).toISODate(),
      absence: targetFingerprint.absence ? 'نعم' : 'لا',
      annualLeave: targetFingerprint.annualLeave ? 'نعم' : 'لا',
      medicalLeave: targetFingerprint.medicalLeave ? 'نعم' : 'لا',
      officialLeave: targetFingerprint.officialLeave ? 'نعم' : 'لا',
      leaveCompensation: targetFingerprint.leaveCompensation ? parseFloat(targetFingerprint.leaveCompensation).toFixed(2) : 'لا',
      appropriateValue: targetFingerprint.appropriateValue ? parseFloat(targetFingerprint.appropriateValue).toFixed(2) : 'لا',
      isSingleFingerprint: targetFingerprint.isSingleFingerprint ? 'نعم' : '',
    };

    res.json({
      message: existingReport ? 'تم دمج السجل المكرر وتحديثه بنجاح' : 'تم حفظ التعديلات بنجاح',
      report: responseReport,
    });
  } catch (error) {
    console.error('Error in update route:', error.message, error.stack);
    res.status(500).json({ error: 'خطأ في التعديل', details: error.message });
  }
});


import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 60 }); // ذاكرة مؤقتة لمدة 60 ثانية

// تقرير المرتب الشهري
router.get('/salary-report', authMiddleware, async (req, res) => {
  const { code, dateFrom, dateTo } = req.query;
  const cache = req.app.get('cache');

  try {
    if (!req.user || !req.user.code || !req.user.role) {
      console.error('Invalid or missing user data in token:', req.user);
      return res.status(401).json({ message: 'التوكن غير صالح أو منتهي الصلاحية' });
    }

    const cacheKey = `${req.user.code}:${code || 'all'}:${dateFrom}:${dateTo}`;
    let cachedReport;
    try {
      cachedReport = cache.get(cacheKey);
    } catch (cacheError) {
      console.error('Error accessing cache:', cacheError.message);
    }
    if (cachedReport) {
      console.log(`Returning cached salary report for key: ${cacheKey}`);
      return res.json(cachedReport);
    }

    console.log(`Processing salary report request for code: ${code || 'all'}, dateFrom: ${dateFrom}, dateTo: ${dateTo}, user: ${req.user.code}, role: ${req.user.role}`);

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date range:', { dateFrom, dateTo });
      return res.status(400).json({ message: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    let queryCode = code;
    if (req.user.role !== 'admin') {
      queryCode = req.user.code;
      if (code && code !== req.user.code) {
        console.error(`User ${req.user.code} attempted to access report for code ${code}`);
        return res.status(403).json({ message: 'غير مصرح لعرض تقارير مستخدمين آخرين' });
      }
    }

    const users = queryCode ? await User.find({ code: queryCode }).lean() : await User.find().lean();
    if (queryCode && users.length === 0) {
      console.error(`No user found for code ${queryCode}`);
      return res.status(404).json({ message: `لا يوجد مستخدم بالكود ${queryCode}` });
    }

    const salaryReports = [];
    const processedCodes = new Set();

    for (const user of users) {
      if (processedCodes.has(user.code)) {
        console.warn(`Duplicate user code ${user.code} skipped`);
        continue;
      }
      processedCodes.add(user.code);

      if (!user.baseSalary || user.baseSalary <= 0) {
        console.warn(`Invalid or missing baseSalary for user ${user.code}: ${user.baseSalary}`);
        continue;
      }

      console.log(`Retrieved user data for ${user.code}:`, {
        baseSalary: user.baseSalary,
        penaltiesValue: user.penaltiesValue,
        violationsInstallment: user.violationsInstallment,
        totalViolationsValue: user.totalViolationsValue,
        advances: user.advances,
        deductionsValue: user.deductionsValue,
      });

      const query = {
        code: user.code,
        date: { $gte: startDate.toJSDate(), $lte: endDate.toJSDate() },
      };
      const fingerprints = await Fingerprint.find(query).sort({ date: 1 }).lean();

      const missingReports = [];
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const existingReport = fingerprints.find(
          r => r.code === user.code && DateTime.fromJSDate(r.date).toISODate() === dateStr
        );
        if (!existingReport) {
          const workDaysPerWeek = user.workDaysPerWeek || 6;
          if (isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek)) {
            const weeklyLeaveReport = {
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            };
            const existingWeeklyReport = await Fingerprint.findOne({
              code: user.code,
              date: {
                $gte: currentDate.startOf('day').toJSDate(),
                $lte: currentDate.endOf('day').toJSDate(),
              },
            }).lean();
            if (!existingWeeklyReport) {
              console.log(`Creating weekly leave report for ${user.code} on ${dateStr}`);
              const fingerprint = new Fingerprint(weeklyLeaveReport);
              await fingerprint.calculateAttendance();
              await fingerprint.save();
              missingReports.push(fingerprint.toObject());
            }
          } else {
            const existingAbsenceReport = await Fingerprint.findOne({
              code: user.code,
              date: {
                $gte: currentDate.startOf('day').toJSDate(),
                $lte: currentDate.endOf('day').toJSDate(),
              },
            }).lean();
            if (!existingAbsenceReport) {
              const absenceReport = {
                code: user.code,
                date: currentDate.toJSDate(),
                checkIn: null,
                checkOut: null,
                workHours: 0,
                overtime: 0,
                lateMinutes: 0,
                lateDeduction: 0,
                earlyLeaveDeduction: 1,
                absence: true,
                annualLeave: false,
                medicalLeave: false,
                officialLeave: false,
                leaveCompensation: 0,
                medicalLeaveDeduction: 0,
                appropriateValue: 0,
                appropriateValueDays: 0,
                isSingleFingerprint: false,
                workDaysPerWeek,
                employeeName: user.fullName || 'غير معروف',
                monthlyLateAllowance: user.monthlyLateAllowance || 120,
                customAnnualLeave: user.customAnnualLeave || 0,
                annualLeaveBalance: user.annualLeaveBalance || 21,
                advances: user.advances || 0,
              };
              console.log(`Creating absence report for ${user.code} on ${dateStr}`);
              const fingerprint = new Fingerprint(absenceReport);
              await fingerprint.calculateAttendance();
              await fingerprint.save();
              missingReports.push(fingerprint.toObject());
            }
          }
        } else {
          existingReport.employeeName = user.fullName || 'غير معروف';
          existingReport.monthlyLateAllowance = user.monthlyLateAllowance || 120;
          existingReport.customAnnualLeave = user.customAnnualLeave || 0;
          existingReport.annualLeaveBalance = user.annualLeaveBalance || 21;
          existingReport.advances = user.advances || 0;
          existingReport.appropriateValue = existingReport.appropriateValue || 0;
          existingReport.appropriateValueDays = existingReport.appropriateValue ? 1 : 0;
          existingReport.isSingleFingerprint = (existingReport.checkIn && !existingReport.checkOut) || (!existingReport.checkIn && existingReport.checkOut);
          await Fingerprint.findByIdAndUpdate(existingReport._id, existingReport, { new: true });
        }
        currentDate = currentDate.plus({ days: 1 });
      }

      const allReports = [...fingerprints, ...missingReports].sort((a, b) => new Date(a.date) - new Date(b.date));

      const totals = allReports.reduce(
        (acc, report) => {
          const isWorkDay = !report.absence && !report.annualLeave && !report.medicalLeave && !report.officialLeave && !report.leaveCompensation && !isWeeklyLeaveDay(report.date, user.workDaysPerWeek);
          acc.totalWorkHours += report.workHours || 0;
          acc.totalWorkDays += isWorkDay ? 1 : 0;
          acc.totalAbsenceDays += report.absence ? 1 : 0;
          acc.totalLateDays += report.lateDeduction > 0 ? 1 : 0;
          acc.lateDeductionDays += report.lateDeduction || 0;
          acc.earlyLeaveDeductionDays += report.earlyLeaveDeduction || 0;
          acc.medicalLeaveDeductionDays += report.medicalLeaveDeduction || 0;
          acc.totalOvertime += report.overtime || 0;
          acc.totalWeeklyLeaveDays += isWeeklyLeaveDay(report.date, user.workDaysPerWeek) ? 1 : 0;
          acc.totalAnnualLeaveDays += report.annualLeave ? 1 : 0;
          acc.totalMedicalLeaveDays += report.medicalLeave ? 1 : 0;
          acc.totalOfficialLeaveDays += report.officialLeave ? 1 : 0;
          acc.totalLeaveCompensationDays += report.leaveCompensation ? 1 : 0;
          acc.totalLeaveCompensationValue += report.leaveCompensation ? parseFloat(report.leaveCompensation) : 0;
          acc.totalAppropriateValueDays += report.appropriateValue ? 1 : 0;
          acc.totalAppropriateValue += report.appropriateValue ? parseFloat(report.appropriateValue) : 0;
          return acc;
        },
        {
          totalWorkHours: 0,
          totalWorkDays: 0,
          totalAbsenceDays: 0,
          totalLateDays: 0,
          lateDeductionDays: 0,
          earlyLeaveDeductionDays: 0,
          medicalLeaveDeductionDays: 0,
          totalOvertime: 0,
          totalWeeklyLeaveDays: 0,
          totalAnnualLeaveDays: 0,
          totalMedicalLeaveDays: 0,
          totalOfficialLeaveDays: 0,
          totalLeaveCompensationDays: 0,
          totalLeaveCompensationValue: 0,
          totalAppropriateValueDays: 0,
          totalAppropriateValue: 0,
        }
      );

      const totalDays = endDate.diff(startDate, 'days').days + 1;
      if (totals.totalWorkDays + totals.totalAbsenceDays + totals.totalAnnualLeaveDays + totals.totalMedicalLeaveDays + totals.totalOfficialLeaveDays + totals.totalLeaveCompensationDays + totals.totalAppropriateValueDays !== totalDays) {
        totals.totalWeeklyLeaveDays = totalDays - (totals.totalWorkDays + totals.totalAbsenceDays + totals.totalAnnualLeaveDays + totals.totalMedicalLeaveDays + totals.totalOfficialLeaveDays + totals.totalLeaveCompensationDays + totals.totalAppropriateValueDays);
      }

      const dailySalary = user.baseSalary / 30;
      const hourlyRate = dailySalary / 9;
      const overtimeValue = (totals.totalOvertime * hourlyRate).toFixed(2);
      const baseMealAllowance = user.mealAllowance || 0;
      const mealAllowance = (baseMealAllowance - (totals.totalAbsenceDays + totals.totalAnnualLeaveDays + totals.totalMedicalLeaveDays + totals.totalOfficialLeaveDays + totals.totalLeaveCompensationDays + totals.totalAppropriateValueDays) * 50).toFixed(2);
      const bonus = (user.baseBonus || 0) * ((user.bonusPercentage || 0) / 100);
      const deductionsValue = ((totals.totalAbsenceDays + totals.lateDeductionDays + totals.earlyLeaveDeductionDays + totals.medicalLeaveDeductionDays) * dailySalary + (user.penaltiesValue || 0) + (user.violationsInstallment || 0) + (user.advances || 0)).toFixed(2);

      const salaryReport = {
        code: user.code,
        fullName: user.fullName || 'غير معروف',
        department: user.department || 'غير محدد',
        baseSalary: user.baseSalary,
        medicalInsurance: user.medicalInsurance || 0,
        socialInsurance: user.socialInsurance || 0,
        mealAllowance: parseFloat(mealAllowance),
        bonus: bonus.toFixed(2),
        eidBonus: user.eidBonus || 0,
        advances: user.advances || 0,
        totalWorkHours: totals.totalWorkHours.toFixed(2),
        totalWorkDays: totals.totalWorkDays,
        totalAbsenceDays: totals.totalAbsenceDays,
        totalLateDays: totals.totalLateDays,
        lateDeductionDays: totals.lateDeductionDays.toFixed(2),
        earlyLeaveDeductionDays: totals.earlyLeaveDeductionDays.toFixed(2),
        medicalLeaveDeductionDays: totals.medicalLeaveDeductionDays.toFixed(2),
        deductionsValue: parseFloat(deductionsValue),
        totalOvertime: totals.totalOvertime.toFixed(2),
        overtimeValue: parseFloat(overtimeValue),
        totalWeeklyLeaveDays: totals.totalWeeklyLeaveDays,
        totalAnnualLeaveDays: totals.totalAnnualLeaveDays,
        totalMedicalLeaveDays: totals.totalMedicalLeaveDays,
        totalOfficialLeaveDays: totals.totalOfficialLeaveDays,
        totalLeaveCompensationDays: totals.totalLeaveCompensationDays,
        totalLeaveCompensationValue: totals.totalLeaveCompensationValue.toFixed(2),
        totalAppropriateValueDays: totals.totalAppropriateValueDays,
        totalAppropriateValue: totals.totalAppropriateValue.toFixed(2),
        customAnnualLeave: user.customAnnualLeave || 0,
        annualLeaveBalance: user.annualLeaveBalance || 21,
        monthlyLateAllowance: user.monthlyLateAllowance || 120,
        penaltiesValue: user.penaltiesValue || 0,
        violationsInstallment: user.violationsInstallment || 0,
        totalViolationsValue: user.totalViolationsValue || 0,
        netSalary: (
          user.baseSalary +
          parseFloat(mealAllowance) +
          parseFloat(overtimeValue) +
          bonus +
          (user.eidBonus || 0) +
          totals.totalLeaveCompensationValue +
          totals.totalAppropriateValue -
          (user.medicalInsurance || 0) -
          (user.socialInsurance || 0) -
          parseFloat(deductionsValue)
        ).toFixed(2),
      };

      if (req.user.role !== 'admin') {
        delete salaryReport.penaltiesValue;
        delete salaryReport.violationsInstallment;
        delete salaryReport.totalViolationsValue;
      }

      salaryReports.push(salaryReport);
    }

    if (salaryReports.length === 0) {
      console.error('No valid salary reports generated', { queryCode, dateFrom, dateTo });
      return res.status(404).json({ message: 'لا توجد تقارير مرتبات صالحة للفترة المحددة' });
    }

    try {
      cache.set(cacheKey, { salaryReports }, 60);
      console.log(`Cached salary report for key: ${cacheKey}`);
    } catch (cacheError) {
      console.error('Error setting cache:', cacheError.message);
    }

    res.json({ salaryReports });
  } catch (error) {
    console.error('Error in salary-report route:', error.message, error.stack);
    res.status(500).json({ message: 'خطأ في جلب تقرير المرتب الشهري', error: error.message });
  }
});
// ... باقي الكود كما هو ...

// تحديث بيانات مستخدم
router.put('/:code', authMiddleware, async (req, res) => {
  try {
    console.log('Received update request for user:', req.params.code, 'Data:', req.body);
    const { penaltiesValue, violationsInstallment, totalViolationsValue, advances, deductionsValue, createdBy } = req.body;

    // التحقق من وجود حقل واحد على الأقل للتعديل
    if (
      penaltiesValue === undefined &&
      violationsInstallment === undefined &&
      advances === undefined &&
      totalViolationsValue === undefined &&
      deductionsValue === undefined
    ) {
      console.error('No valid fields provided for update');
      return res.status(400).json({ message: 'يجب تقديم حقل واحد على الأقل للتعديل (قيمة الجزاءات، قسط المخالفات، السلف)' });
    }

    // التحقق من القيم الرقمية
    const numericFields = {
      penaltiesValue,
      violationsInstallment,
      totalViolationsValue,
      advances,
      deductionsValue,
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
    user.createdBy = createdBy || user.createdBy;

    // تسجيل البيانات قبل الحفظ
    console.log('Data before save:', {
      code: user.code,
      penaltiesValue: user.penaltiesValue,
      violationsInstallment: user.violationsInstallment,
      totalViolationsValue: user.totalViolationsValue,
      advances: user.advances,
      deductionsValue: user.deductionsValue,
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
    const cacheKeys = cache.keys().filter(key => key.includes(`${req.params.code}:`));
    cacheKeys.forEach(key => {
      console.log(`Invalidating cache key: ${key}`);
      cache.del(key);
    });

    // جلب البيانات المحدثة
    const netSalaryData = await user.netSalary;
    console.log('Updated user:', {
      code: user.code,
      penaltiesValue: user.penaltiesValue,
      violationsInstallment: user.violationsInstallment,
      totalViolationsValue: user.totalViolationsValue,
      advances: user.advances,
      deductionsValue: user.deductionsValue,
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


// استرجاع سجل بصمة واحد
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const fingerprint = await Fingerprint.findById(req.params.id);
    if (!fingerprint) {
      console.error(`Fingerprint not found for ID ${req.params.id}`);
      return res.status(404).json({ message: 'السجل غير موجود' });
    }

    const user = await User.findOne({ code: fingerprint.code });
    if (!user) {
      console.error(`User not found for code ${fingerprint.code}`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    fingerprint.employeeName = user.fullName || 'غير معروف';
    fingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
    fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
    fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
    fingerprint.advances = user.advances || 0;
    fingerprint.appropriateValue = fingerprint.appropriateValue || 0;
    fingerprint.appropriateValueDays = fingerprint.appropriateValue ? 1 : 0;
    await fingerprint.save();

    const workDaysPerWeek = user.workDaysPerWeek || 6;
    const responseReport = {
      ...fingerprint.toObject(),
      employeeName: user.fullName || 'غير معروف',
      workDaysPerWeek,
      monthlyLateAllowance: user.monthlyLateAllowance || 120,
      customAnnualLeave: user.customAnnualLeave || 0,
      annualLeaveBalance: user.annualLeaveBalance || 21,
      advances: user.advances || 0,
      weeklyLeaveDays: isWeeklyLeaveDay(fingerprint.date, workDaysPerWeek) ? 1 : 0,
      annualLeaveDays: fingerprint.annualLeave ? 1 : 0,
      medicalLeaveDays: fingerprint.medicalLeave ? 1 : 0,
      officialLeaveDays: fingerprint.officialLeave ? 1 : 0,
      leaveCompensationDays: fingerprint.leaveCompensation ? 1 : 0,
      appropriateValueDays: fingerprint.appropriateValue ? 1 : 0,
      checkIn: fingerprint.checkIn ? DateTime.fromJSDate(fingerprint.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
      checkOut: fingerprint.checkOut ? DateTime.fromJSDate(fingerprint.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
      date: DateTime.fromJSDate(fingerprint.date, { zone: 'Africa/Cairo' }).toISODate(),
      absence: fingerprint.absence ? 'نعم' : 'لا',
      annualLeave: fingerprint.annualLeave ? 'نعم' : 'لا',
      medicalLeave: fingerprint.medicalLeave ? 'نعم' : 'لا',
      officialLeave: fingerprint.officialLeave ? 'نعم' : 'لا',
      leaveCompensation: fingerprint.leaveCompensation ? parseFloat(fingerprint.leaveCompensation).toFixed(2) : 'لا',
      appropriateValue: fingerprint.appropriateValue ? parseFloat(fingerprint.appropriateValue).toFixed(2) : 'لا',
      isSingleFingerprint: fingerprint.isSingleFingerprint ? 'نعم' : '',
    };

    res.json({ report: responseReport });
  } catch (error) {
    console.error('Error in fetch single report route:', error.message);
    res.status(500).json({ message: 'خطأ في جلب السجل', error: error.message });
  }
});

// تحديث سجل بصمة
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const fingerprint = await Fingerprint.findById(req.params.id);
    if (!fingerprint) {
      console.error(`Fingerprint not found for ID ${req.params.id}`);
      return res.status(404).json({ error: 'السجل غير موجود' });
    }

    const { code, date, checkIn, checkOut, absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue } = req.body;

    // التحقق من وجود حالة واحدة فقط
    if ([absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue].filter(Boolean).length > 1) {
      console.error('Multiple status flags set:', { absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue });
      return res.status(400).json({ error: 'لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة، قيمة مناسبة)' });
    }

    // التحقق من تنسيق التاريخ
    const dateDt = DateTime.fromISO(date, { zone: 'Africa/Cairo' });
    if (!dateDt.isValid) {
      console.error('Invalid date format:', date);
      return res.status(400).json({ error: 'تاريخ السجل غير صالح' });
    }

    // التحقق من وجود المستخدم
    const user = await User.findOne({ code: code || fingerprint.code });
    if (!user) {
      console.error(`User not found for code ${code || fingerprint.code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // التحقق من رصيد الإجازة السنوية
    if (annualLeave && !fingerprint.annualLeave && user.annualLeaveBalance <= 0) {
      console.error(`Insufficient annual leave balance for code ${code || fingerprint.code}`);
      return res.status(400).json({ error: 'رصيد الإجازة السنوية غير كافٍ' });
    }

    // التحقق من وجود سجل مكرر
    const existingReport = await Fingerprint.findOne({
      code: code || fingerprint.code,
      date: {
        $gte: dateDt.startOf('day').toJSDate(),
        $lte: dateDt.endOf('day').toJSDate(),
      },
      _id: { $ne: req.params.id },
    });

    let targetFingerprint = fingerprint;
    if (existingReport) {
      console.log(`Found duplicate report for code ${code || fingerprint.code} on ${dateDt.toISODate()}, merging...`);
      targetFingerprint = existingReport;
      await Fingerprint.deleteOne({ _id: req.params.id }); // حذف السجل الأصلي
    }

    // تحديث الحقول
    targetFingerprint.code = code || fingerprint.code;
    targetFingerprint.date = dateDt.toJSDate();
    targetFingerprint.checkIn = (annualLeave || medicalLeave || officialLeave || leaveCompensation || absence)
      ? null
      : (checkIn ? DateTime.fromISO(checkIn, { zone: 'Africa/Cairo' }).toJSDate() : fingerprint.checkIn);
    targetFingerprint.checkOut = (annualLeave || medicalLeave || officialLeave || leaveCompensation || absence)
      ? null
      : (checkOut ? DateTime.fromISO(checkOut, { zone: 'Africa/Cairo' }).toJSDate() : fingerprint.checkOut);
    targetFingerprint.absence = absence !== undefined ? absence : fingerprint.absence;
    targetFingerprint.annualLeave = annualLeave !== undefined ? annualLeave : fingerprint.annualLeave;
    targetFingerprint.medicalLeave = medicalLeave !== undefined ? medicalLeave : fingerprint.medicalLeave;
    targetFingerprint.officialLeave = officialLeave !== undefined ? officialLeave : fingerprint.officialLeave;
    targetFingerprint.leaveCompensation = leaveCompensation !== undefined
      ? (leaveCompensation ? (user.baseSalary / 30 * 2).toFixed(2) : 0)
      : fingerprint.leaveCompensation;
    targetFingerprint.appropriateValue = appropriateValue !== undefined ? appropriateValue : fingerprint.appropriateValue || 0;
    targetFingerprint.appropriateValueDays = appropriateValue !== undefined ? (appropriateValue ? 1 : 0) : fingerprint.appropriateValueDays || 0;
    targetFingerprint.employeeName = user.fullName || 'غير معروف';
    targetFingerprint.workDaysPerWeek = user.workDaysPerWeek || 6;
    targetFingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
    targetFingerprint.customAnnualLeave = user.customAnnualLeave || 0;
    targetFingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
    targetFingerprint.advances = user.advances || 0;

    // تحديث رصيد الإجازة السنوية
    if (targetFingerprint.annualLeave && !fingerprint.annualLeave) {
      user.annualLeaveBalance -= 1;
      await user.save();
      console.log(`Deducted 1 day from annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    } else if (!targetFingerprint.annualLeave && fingerprint.annualLeave) {
      user.annualLeaveBalance += 1;
      await user.save();
      console.log(`Restored 1 day to annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    }

    // إعادة حساب الحقول المشتقة
    await targetFingerprint.calculateAttendance();
    await handleLateDeduction(targetFingerprint);
    await handleEarlyLeaveDeduction(targetFingerprint);

    // حفظ السجل
    await targetFingerprint.save();

    // إعداد الاستجابة
    const responseReport = {
      ...targetFingerprint.toObject(),
      employeeName: user.fullName || 'غير معروف',
      workDaysPerWeek: user.workDaysPerWeek || 6,
      monthlyLateAllowance: user.monthlyLateAllowance || 120,
      customAnnualLeave: user.customAnnualLeave || 0,
      annualLeaveBalance: user.annualLeaveBalance || 21,
      advances: user.advances || 0,
      weeklyLeaveDays: isWeeklyLeaveDay(targetFingerprint.date, user.workDaysPerWeek) ? 1 : 0,
      annualLeaveDays: targetFingerprint.annualLeave ? 1 : 0,
      medicalLeaveDays: targetFingerprint.medicalLeave ? 1 : 0,
      officialLeaveDays: targetFingerprint.officialLeave ? 1 : 0,
      leaveCompensationDays: targetFingerprint.leaveCompensation ? 1 : 0,
      appropriateValueDays: targetFingerprint.appropriateValue ? 1 : 0,
      checkIn: targetFingerprint.checkIn
        ? DateTime.fromJSDate(targetFingerprint.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a')
        : null,
      checkOut: targetFingerprint.checkOut
        ? DateTime.fromJSDate(targetFingerprint.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a')
        : null,
      date: DateTime.fromJSDate(targetFingerprint.date, { zone: 'Africa/Cairo' }).toISODate(),
      absence: targetFingerprint.absence ? 'نعم' : 'لا',
      annualLeave: targetFingerprint.annualLeave ? 'نعم' : 'لا',
      medicalLeave: targetFingerprint.medicalLeave ? 'نعم' : 'لا',
      officialLeave: targetFingerprint.officialLeave ? 'نعم' : 'لا',
      leaveCompensation: targetFingerprint.leaveCompensation ? parseFloat(targetFingerprint.leaveCompensation).toFixed(2) : 'لا',
      appropriateValue: targetFingerprint.appropriateValue ? parseFloat(targetFingerprint.appropriateValue).toFixed(2) : 'لا',
      isSingleFingerprint: targetFingerprint.isSingleFingerprint ? 'نعم' : '',
    };

    res.json({
      message: existingReport ? 'تم دمج السجل المكرر وتحديثه بنجاح' : 'تم حفظ التعديلات بنجاح',
      report: responseReport,
    });
  } catch (error) {
    console.error('Error in update route:', error.message, error.stack);
    res.status(500).json({ error: 'خطأ في التعديل', details: error.message });
  }
});
// حذف جميع سجلات البصمات
router.delete('/all', authMiddleware, async (req, res) => {
  try {
    const annualLeaveFingerprints = await Fingerprint.find({ annualLeave: true });
    for (const fingerprint of annualLeaveFingerprints) {
      const user = await User.findOne({ code: fingerprint.code });
      if (user) {
        user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
        await user.save();
        console.log(`Restored 1 day to annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
      }
    }

    const result = await Fingerprint.deleteMany({});
    console.log(`Deleted ${result.deletedCount} fingerprint records`);
    res.json({ message: 'تم حذف جميع سجلات البصمات بنجاح', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error deleting all fingerprints:', error.message);
    res.status(500).json({ message: 'خطأ في حذف جميع البصمات', error: error.message });
  }
});

// حذف سجل بصمة واحد
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const fingerprint = await Fingerprint.findById(req.params.id);
    if (!fingerprint) {
      console.error(`Fingerprint not found for ID ${req.params.id}`);
      return res.status(404).json({ message: 'السجل غير موجود' });
    }

    const user = await User.findOne({ code: fingerprint.code });
    if (!user) {
      console.error(`User not found for code ${fingerprint.code}`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (fingerprint.annualLeave) {
      user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
      await user.save();
      console.log(`Restored 1 day to annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
    }

    await Fingerprint.deleteOne({ _id: req.params.id });
    console.log(`Deleted fingerprint with ID ${req.params.id}`);
    res.json({ message: 'تم حذف السجل بنجاح' });
  } catch (error) {
    console.error('Error deleting fingerprint:', error.message);
    res.status(500).json({ message: 'خطأ في حذف السجل', error: error.message });
  }
});

// إنشاء/تحديث إجازة رسمية
router.post('/official-leave', authMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.body;
    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date range:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    const users = code ? [await User.findOne({ code })] : await User.find();
    if (code && !users[0]) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const reports = [];
    for (const user of users) {
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const workDaysPerWeek = user.workDaysPerWeek || 6;
        const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

        if (!isWeekly) {
          const existingReport = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          let fingerprint;
          if (existingReport) {
            console.log(`Updating existing report for official leave for ${user.code} on ${dateStr}`);
            fingerprint = existingReport;
            fingerprint.checkIn = null;
            fingerprint.checkOut = null;
            fingerprint.workHours = 0;
            fingerprint.overtime = 0;
            fingerprint.lateMinutes = 0;
            fingerprint.lateDeduction = 0;
            fingerprint.earlyLeaveDeduction = 0;
            fingerprint.absence = false;
            fingerprint.annualLeave = false;
            fingerprint.medicalLeave = false;
            fingerprint.officialLeave = true;
            fingerprint.leaveCompensation = 0;
            fingerprint.medicalLeaveDeduction = 0;
            fingerprint.appropriateValue = 0;
            fingerprint.appropriateValueDays = 0;
            fingerprint.employeeName = user.fullName || 'غير معروف';
            fingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
            fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
            fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
            fingerprint.advances = user.advances || 0;
          } else {
            console.log(`Creating new report for official leave for ${user.code} on ${dateStr}`);
            fingerprint = new Fingerprint({
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: true,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            });
          }

          await fingerprint.calculateAttendance();
          await fingerprint.save();
          reports.push(fingerprint);
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }
const responseReports = await Promise.all(
      reports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          monthlyLateAllowance: user ? user.monthlyLateAllowance : 120,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation ? 1 : 0,
          appropriateValueDays: report.appropriateValue ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : '',
        };
      })
    );

    res.json({
      message: 'تم تسجيل الإجازة الرسمية بنجاح',
      reports: responseReports,
    });
  } catch (error) {
    console.error('Error in official-leave route:', error.message);
    res.status(500).json({ message: 'خطأ في تسجيل الإجازة الرسمية', error: error.message });
  }
});

// إنشاء/تحديث قيمة مناسبة
router.post('/appropriate-value', authMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo, appropriateValue } = req.body;

    if (!appropriateValue || isNaN(appropriateValue) || appropriateValue <= 0) {
      console.error('Invalid appropriateValue:', appropriateValue);
      return res.status(400).json({ error: 'القيمة المناسبة يجب أن تكون رقمًا موجبًا' });
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date range:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    const users = code ? [await User.findOne({ code })] : await User.find();
    if (code && !users[0]) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const reports = [];
    for (const user of users) {
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const workDaysPerWeek = user.workDaysPerWeek || 6;
        const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

        if (!isWeekly) {
          const existingReport = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          let fingerprint;
          if (existingReport) {
            console.log(`Updating existing report for appropriate value for ${user.code} on ${dateStr}`);
            fingerprint = existingReport;
            if (fingerprint.annualLeave || fingerprint.medicalLeave || fingerprint.officialLeave || fingerprint.leaveCompensation || fingerprint.absence) {
              console.log(`Skipping appropriate value update for ${user.code} on ${dateStr} due to existing status`);
              continue;
            }
            fingerprint.appropriateValue = appropriateValue;
            fingerprint.appropriateValueDays = 1;
            fingerprint.employeeName = user.fullName || 'غير معروف';
            fingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
            fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
            fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
            fingerprint.advances = user.advances || 0;
          } else {
            console.log(`Creating new report for appropriate value for ${user.code} on ${dateStr}`);
            fingerprint = new Fingerprint({
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: appropriateValue,
              appropriateValueDays: 1,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            });
          }

          await fingerprint.calculateAttendance();
          await handleLateDeduction(fingerprint);
          await handleEarlyLeaveDeduction(fingerprint);
          await fingerprint.save();
          reports.push(fingerprint);
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }

    const responseReports = await Promise.all(
      reports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          monthlyLateAllowance: user ? user.monthlyLateAllowance : 120,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation ? 1 : 0,
          appropriateValueDays: report.appropriateValue ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : '',
        };
      })
    );

    res.json({
      message: 'تم تسجيل القيمة المناسبة بنجاح',
      reports: responseReports,
    });
  } catch (error) {
    console.error('Error in appropriate-value route:', error.message);
    res.status(500).json({ message: 'خطأ في تسجيل القيمة المناسبة', error: error.message });
  }
});





router.post('/', authMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.body;

    // التحقق من وجود المستخدم
    const user = await User.findOne({ code });
    if (!user) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // التحقق من عدم وجود تقرير مكرر
    const existingReport = await MonthlyBonusReport.findOne({
      code,
      dateFrom: DateTime.fromISO(dateFrom).toJSDate(),
      dateTo: DateTime.fromISO(dateTo).toJSDate(),
    });
    if (existingReport) {
      console.error(`Report already exists for code ${code} from ${dateFrom} to ${dateTo}`);
      return res.status(400).json({ error: 'تقرير موجود مسبقًا لهذا الموظف في هذه الفترة' });
    }

    const report = new MonthlyBonusReport({
      ...req.body,
      createdBy: req.user.id, // استخدام معرف المستخدم من التوكن
    });
    await report.save();
    console.log(`Created report for code ${code} from ${dateFrom} to ${dateTo}`);
    res.status(201).json({ message: 'تم حفظ التقرير بنجاح', report });
  } catch (error) {
    console.error('Error saving report:', error.message);
    res.status(500).json({ error: 'خطأ في حفظ التقرير', details: error.message });
  }
});

// تحديث تقرير
router.put('/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const { dateFrom, dateTo } = req.body;

    const report = await MonthlyBonusReport.findOneAndUpdate(
      {
        code,
        dateFrom: DateTime.fromISO(dateFrom).toJSDate(),
        dateTo: DateTime.fromISO(dateTo).toJSDate(),
      },
      {
        ...req.body,
        createdBy: req.user.id,
      },
      { new: true }
    );

    if (!report) {
      console.error(`Report not found for code ${code} from ${dateFrom} to ${dateTo}`);
      return res.status(404).json({ error: 'التقرير غير موجود' });
    }

    console.log(`Updated report for code ${code} from ${dateFrom} to ${dateTo}`);
    res.json({ message: 'تم تحديث التقرير بنجاح', report });
  } catch (error) {
    console.error('Error updating report:', error.message);
    res.status(500).json({ error: 'خطأ في تحديث التقرير', details: error.message });
  }
});




router.post('/annual-leave', authMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.body;
    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date range:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    const users = code ? [await User.findOne({ code })] : await User.find();
    if (code && !users[0]) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const reports = [];
    for (const user of users) {
      const totalDays = endDate.diff(startDate, 'days').days + 1;
      if (user.annualLeaveBalance < totalDays) {
        console.error(`Insufficient annual leave balance for ${user.code}: ${user.annualLeaveBalance} days available`);
        return res.status(400).json({ error: `رصيد الإجازة السنوية غير كافٍ لـ ${user.code}` });
      }

      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const workDaysPerWeek = user.workDaysPerWeek || 6;
        const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

        if (!isWeekly) {
          const existingReport = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          let fingerprint;
          if (existingReport) {
            console.log(`Updating existing report for annual leave for ${user.code} on ${dateStr}`);
            fingerprint = existingReport;
            fingerprint.checkIn = null;
            fingerprint.checkOut = null;
            fingerprint.workHours = 0;
            fingerprint.overtime = 0;
            fingerprint.lateMinutes = 0;
            fingerprint.lateDeduction = 0;
            fingerprint.earlyLeaveDeduction = 0;
            fingerprint.absence = false;
            fingerprint.annualLeave = true;
            fingerprint.medicalLeave = false;
            fingerprint.officialLeave = false;
            fingerprint.leaveCompensation = 0;
            fingerprint.medicalLeaveDeduction = 0;
            fingerprint.appropriateValue = 0;
            fingerprint.appropriateValueDays = 0;
            fingerprint.employeeName = user.fullName || 'غير معروف';
            fingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
            fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
            fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
            fingerprint.advances = user.advances || 0;
          } else {
            console.log(`Creating new report for annual leave for ${user.code} on ${dateStr}`);
            fingerprint = new Fingerprint({
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: true,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            });
          }

          await fingerprint.calculateAttendance();
          await fingerprint.save();
          reports.push(fingerprint);
          user.annualLeaveBalance -= 1;
          await user.save();
          console.log(`Deducted 1 day from annualLeaveBalance for ${user.code}. New balance: ${user.annualLeaveBalance}`);
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }

    const responseReports = await Promise.all(
      reports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          monthlyLateAllowance: user ? user.monthlyLateAllowance : 120,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation ? 1 : 0,
          appropriateValueDays: report.appropriateValue ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : '',
        };
      })
    );

    res.json({
      message: 'تم تسجيل الإجازة السنوية بنجاح',
      reports: responseReports,
    });
  } catch (error) {
    console.error('Error in annual-leave route:', error.message);
    res.status(500).json({ message: 'خطأ في تسجيل الإجازة السنوية', error: error.message });
  }
});


router.post('/medical-leave', authMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.body;
    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date range:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    const users = code ? [await User.findOne({ code })] : await User.find();
    if (code && !users[0]) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const reports = [];
    for (const user of users) {
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const workDaysPerWeek = user.workDaysPerWeek || 6;
        const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

        if (!isWeekly) {
          const existingReport = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          let fingerprint;
          if (existingReport) {
            console.log(`Updating existing report for medical leave for ${user.code} on ${dateStr}`);
            fingerprint = existingReport;
            fingerprint.checkIn = null;
            fingerprint.checkOut = null;
            fingerprint.workHours = 0;
            fingerprint.overtime = 0;
            fingerprint.lateMinutes = 0;
            fingerprint.lateDeduction = 0;
            fingerprint.earlyLeaveDeduction = 0;
            fingerprint.absence = false;
            fingerprint.annualLeave = false;
            fingerprint.medicalLeave = true;
            fingerprint.officialLeave = false;
            fingerprint.leaveCompensation = 0;
            fingerprint.medicalLeaveDeduction = 0;
            fingerprint.appropriateValue = 0;
            fingerprint.appropriateValueDays = 0;
            fingerprint.employeeName = user.fullName || 'غير معروف';
            fingerprint.monthlyLateAllowance = user.monthlyLateAllowance || 120;
            fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
            fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
            fingerprint.advances = user.advances || 0;
          } else {
            console.log(`Creating new report for medical leave for ${user.code} on ${dateStr}`);
            fingerprint = new Fingerprint({
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: false,
              medicalLeave: true,
              officialLeave: false,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            });
          }

          await fingerprint.calculateAttendance();
          await fingerprint.save();
          reports.push(fingerprint);
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }

    const responseReports = await Promise.all(
      reports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          monthlyLateAllowance: user ? user.monthlyLateAllowance : 120,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation ? 1 : 0,
          appropriateValueDays: report.appropriateValue ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : '',
        };
      })
    );

    res.json({
      message: 'تم تسجيل الإجازة الطبية بنجاح',
      reports: responseReports,
    });
  } catch (error) {
    console.error('Error in medical-leave route:', error.message);
    res.status(500).json({ message: 'خطأ في تسجيل الإجازة الطبية', error: error.message });
  }
});




router.post('/leave-compensation', authMiddleware, async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.body;

    if (!dateFrom || !dateTo) {
      console.error('Missing required fields in request body:', { code, dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية وتاريخ النهاية مطلوبان' });
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });
    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date format:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    const users = code ? [await User.findOne({ code })] : await User.find();
    if (code && !users[0]) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const reports = [];
    for (const user of users) {
      if (!user.baseSalary || user.baseSalary <= 0) {
        console.warn(`Invalid or missing baseSalary for user ${user.code}: ${user.baseSalary}`);
        continue;
      }

      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const workDaysPerWeek = user.workDaysPerWeek || 6;
        const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

        if (!isWeekly) {
          const existingReport = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          // التحقق من الحالات الأخرى
          if (existingReport && (existingReport.annualLeave || existingReport.medicalLeave || existingReport.officialLeave)) {
            console.log(`Skipping update for ${user.code} on ${dateStr} due to existing leave status`);
            continue;
          }

          let fingerprint;
          const leaveCompensationValue = ((user.baseSalary / 30) * 2).toFixed(2);
          console.log(`Calculated leave compensation for ${user.code} on ${dateStr}: ${leaveCompensationValue}`);

          if (existingReport) {
            console.log(`Updating existing report for leave compensation for ${user.code} on ${dateStr}`);
            fingerprint = existingReport;
          } else {
            console.log(`Creating new report for leave compensation for ${user.code} on ${dateStr}`);
            fingerprint = new Fingerprint({
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: leaveCompensationValue,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              monthlyLateAllowance: user.monthlyLateAllowance || 120,
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            });
          }

          // تعيين القيم صراحةً
          fingerprint.leaveCompensation = leaveCompensationValue;
          fingerprint.absence = false;
          fingerprint.earlyLeaveDeduction = 0;
          fingerprint.annualLeave = false;
          fingerprint.medicalLeave = false;
          fingerprint.officialLeave = false;
          fingerprint.appropriateValue = 0;

          await fingerprint.calculateAttendance();
          await handleLateDeduction(fingerprint);
          await handleEarlyLeaveDeduction(fingerprint);
          await fingerprint.save();
          reports.push(fingerprint);

          // إبطال ذاكرة التخزين المؤقت
          const cacheKeys = cache.keys().filter(key => key.includes(`${user.code}:`) || key.includes('all:'));
          cacheKeys.forEach(key => {
            console.log(`Invalidating cache key: ${key}`);
            cache.del(key);
          });
        } else {
          console.log(`Skipping weekly leave day for ${user.code} on ${dateStr}`);
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }

    const responseReports = await Promise.all(
      reports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          monthlyLateAllowance: user ? user.monthlyLateAllowance : 120,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation > 0 ? 1 : 0,
          appropriateValueDays: report.appropriateValue > 0 ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation > 0 ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue > 0 ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : '',
        };
      })
    );

    res.json({
      message: 'تم تسجيل بدل الإجازة بنجاح',
      reports: responseReports,
    });
  } catch (error) {
    console.error('Error in leave-compensation route:', error.message, error.stack);
    res.status(500).json({ message: 'خطأ في تسجيل بدل الإجازة', error: error.message });
  }
});




const leaveCompensationRoute = async (req, res) => {
  try {
    const { code, dateFrom, dateTo } = req.body;

    // التحقق من وجود البيانات المطلوبة
    if (!dateFrom || !dateTo) {
      console.error('Missing required fields in request body:', { code, dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية وتاريخ النهاية مطلوبان' });
    }

    // التحقق من صحة التواريخ
    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });
    if (!startDate.isValid || !endDate.isValid) {
      console.error('Invalid date format:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية أو النهاية غير صالح' });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date:', { dateFrom, dateTo });
      return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    // جلب المستخدمين
    const users = code ? [await User.findOne({ code })] : await User.find();
    if (code && !users[0]) {
      console.error(`User not found for code ${code}`);
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const reports = [];
    for (const user of users) {
      if (!user.baseSalary || user.baseSalary <= 0) {
        console.warn(`Invalid or missing baseSalary for user ${user.code}: ${user.baseSalary}`);
        continue;
      }

      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISODate();
        const workDaysPerWeek = user.workDaysPerWeek || 6;
        const isWeekly = isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek);

        if (!isWeekly) {
          const existingReport = await Fingerprint.findOne({
            code: user.code,
            date: {
              $gte: currentDate.startOf('day').toJSDate(),
              $lte: currentDate.endOf('day').toJSDate(),
            },
          });

          let fingerprint;
          const leaveCompensationValue = ((user.baseSalary / 30) * 2).toFixed(2);
          console.log(`Calculated leave compensation for ${user.code} on ${dateStr}: ${leaveCompensationValue}`);

          if (existingReport) {
            console.log(`Updating existing report for leave compensation for ${user.code} on ${dateStr}`);
            fingerprint = existingReport;
            fingerprint.checkIn = null;
            fingerprint.checkOut = null;
            fingerprint.workHours = 0;
            fingerprint.overtime = 0;
            fingerprint.lateMinutes = 0;
            fingerprint.lateDeduction = 0;
            fingerprint.earlyLeaveDeduction = 0;
            fingerprint.absence = false;
            fingerprint.annualLeave = false;
            fingerprint.medicalLeave = false;
            fingerprint.officialLeave = false;
            fingerprint.leaveCompensation = leaveCompensationValue;
            fingerprint.medicalLeaveDeduction = 0;
            fingerprint.appropriateValue = 0;
            fingerprint.appropriateValueDays = 0;
            fingerprint.employeeName = user.fullName || 'غير معروف';
            fingerprint.workDaysPerWeek = workDaysPerWeek;
            fingerprint.customAnnualLeave = user.customAnnualLeave || 0;
            fingerprint.annualLeaveBalance = user.annualLeaveBalance || 21;
            fingerprint.advances = user.advances || 0;
          } else {
            console.log(`Creating new report for leave compensation for ${user.code} on ${dateStr}`);
            fingerprint = new Fingerprint({
              code: user.code,
              date: currentDate.toJSDate(),
              checkIn: null,
              checkOut: null,
              workHours: 0,
              overtime: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              earlyLeaveDeduction: 0,
              absence: false,
              annualLeave: false,
              medicalLeave: false,
              officialLeave: false,
              leaveCompensation: leaveCompensationValue,
              medicalLeaveDeduction: 0,
              appropriateValue: 0,
              appropriateValueDays: 0,
              isSingleFingerprint: false,
              workDaysPerWeek,
              employeeName: user.fullName || 'غير معروف',
              customAnnualLeave: user.customAnnualLeave || 0,
              annualLeaveBalance: user.annualLeaveBalance || 21,
              advances: user.advances || 0,
            });
          }

          await fingerprint.calculateAttendance();
          await fingerprint.save();
          reports.push(fingerprint);
        } else {
          console.log(`Skipping weekly leave day for ${user.code} on ${dateStr}`);
        }
        currentDate = currentDate.plus({ days: 1 });
      }
    }

    // تنسيق الرد
    const responseReports = await Promise.all(
      reports.map(async report => {
        const user = await User.findOne({ code: report.code });
        const workDaysPerWeek = user ? user.workDaysPerWeek : 6;
        return {
          ...report.toObject(),
          employeeName: user ? user.fullName : 'غير معروف',
          workDaysPerWeek,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
          weeklyLeaveDays: isWeeklyLeaveDay(report.date, workDaysPerWeek) ? 1 : 0,
          annualLeaveDays: report.annualLeave ? 1 : 0,
          medicalLeaveDays: report.medicalLeave ? 1 : 0,
          officialLeaveDays: report.officialLeave ? 1 : 0,
          leaveCompensationDays: report.leaveCompensation > 0 ? 1 : 0,
          appropriateValueDays: report.appropriateValue > 0 ? 1 : 0,
          checkIn: report.checkIn ? DateTime.fromJSDate(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          checkOut: report.checkOut ? DateTime.fromJSDate(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('hh:mm:ss a') : null,
          date: DateTime.fromJSDate(report.date, { zone: 'Africa/Cairo' }).toISODate(),
          absence: report.absence ? 'نعم' : 'لا',
          annualLeave: report.annualLeave ? 'نعم' : 'لا',
          medicalLeave: report.medicalLeave ? 'نعم' : 'لا',
          officialLeave: report.officialLeave ? 'نعم' : 'لا',
          leaveCompensation: report.leaveCompensation > 0 ? parseFloat(report.leaveCompensation).toFixed(2) : 'لا',
          appropriateValue: report.appropriateValue > 0 ? parseFloat(report.appropriateValue).toFixed(2) : 'لا',
          isSingleFingerprint: report.isSingleFingerprint ? 'نعم' : 'لا',
        };
      })
    );

    res.json({
      message: 'تم تسجيل بدل الإجازة بنجاح',
      reports: responseReports,
    });
  } catch (error) {
    console.error('Error in leave-compensation route:', error.message, error.stack);
    res.status(500).json({ message: 'خطأ في تسجيل بدل الإجازة', error: error.message });
  }
};





export default router;
