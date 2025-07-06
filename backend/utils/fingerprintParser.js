import XLSX from 'xlsx';
import { DateTime } from 'luxon';
import Fingerprint from '../models/Fingerprint.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

async function logMissingUserCode(code) {
  const logEntry = `${new Date().toISOString()}: No user found for code ${code}\n`;
  try {
    const logDir = '/app/Logs/';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, 'missing_users.log'), logEntry);
  } catch (err) {
    console.error(`Failed to log missing user code ${code}:`, err.message);
  }
}

export const parseFingerprintFile = async (file) => {
  try {
    if (!file || !file.path) {
      console.error('No file path provided');
      throw new Error('لم يتم توفير ملف صالح');
    }

    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      console.error('No sheets found in the Excel file');
      throw new Error('لا توجد صفحات في ملف Excel');
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) {
      console.error('No data found in the Excel sheet');
      throw new Error('لا توجد بيانات في ملف Excel');
    }

    console.log('Excel data rows:', data.length);

    const reports = [];
    const groupedByCodeAndDate = {};

    for (const [index, row] of data.entries()) {
      try {
        const code = row['No.']?.toString().trim().replace(/\s+/g, '');
        const dateTimeStr = row['Date/Time'];
        const officialLeave = row['Official Leave'] || row['الإجازة الرسمية'] || '';
        const leaveCompensation = row['Leave Compensation'] || row['بدل الإجازة'] || '';

        if (!code || !dateTimeStr) {
          console.warn(`Skipping row ${index + 2}: Missing code or date/time - Code: ${code}, Date/Time: ${dateTimeStr}`);
          continue;
        }

        let dateTime = DateTime.fromFormat(dateTimeStr, 'M/d/yyyy h:mm:ss a', {
          zone: 'Africa/Cairo',
          locale: 'en-US',
        });

        if (!dateTime.isValid) {
          dateTime = DateTime.fromFormat(dateTimeStr, 'dd/MM/yyyy HH:mm:ss', {
            zone: 'Africa/Cairo',
            locale: 'en-US',
          });
        }

        if (!dateTime.isValid) {
          dateTime = DateTime.fromFormat(dateTimeStr, 'yyyy-MM-dd HH:mm:ss', {
            zone: 'Africa/Cairo',
            locale: 'en-US',
          });
        }

        if (!dateTime.isValid) {
          dateTime = DateTime.fromFormat(dateTimeStr, 'dd-MM-yyyy HH:mm:ss', {
            zone: 'Africa/Cairo',
            locale: 'en-US',
          });
        }

        if (!dateTime.isValid) {
          console.warn(`Skipping row ${index + 2}: Invalid date/time format - ${dateTimeStr}, Reason: ${dateTime.invalidReason}`);
          continue;
        }

        const date = dateTime.toJSDate();
        const dateKey = dateTime.toISODate();
        const key = `${code}-${dateKey}`;

        const isOfficialLeave = ['yes', 'true', 'نعم'].includes(officialLeave.toString().toLowerCase().trim());
        const isLeaveCompensation = ['yes', 'true', 'نعم'].includes(leaveCompensation.toString().toLowerCase().trim());

        if (isOfficialLeave && isLeaveCompensation) {
          console.warn(`Skipping row ${index + 2}: Cannot set both officialLeave and leaveCompensation for code ${code} on ${dateKey}`);
          continue;
        }

        if (!groupedByCodeAndDate[key]) {
          groupedByCodeAndDate[key] = [];
        }
        groupedByCodeAndDate[key].push({ dateTime, rowIndex: index + 2, officialLeave: isOfficialLeave, leaveCompensation: isLeaveCompensation });
        console.log(`Added entry for code ${code} on ${dateKey}: ${dateTimeStr}, officialLeave=${isOfficialLeave}, leaveCompensation=${isLeaveCompensation}`);
      } catch (err) {
        console.error(`Error processing row ${index + 2}:`, err.message);
      }
    }

    for (const key in groupedByCodeAndDate) {
      try {
        const [code, dateKey] = key.split('-');
        const user = await User.findOne({ code });
        if (!user) {
          console.warn(`No user found for code ${code}, using default values`);
          await logMissingUserCode(code);
        }

        const entries = groupedByCodeAndDate[key].sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());
        let checkIn = null;
        let checkOut = null;
        let officialLeave = false;
        let leaveCompensation = 0;
        let isSingleFingerprint = false;

        if (entries.length > 0) {
          officialLeave = entries[0].officialLeave;
          if (entries[0].leaveCompensation) {
            leaveCompensation = user ? (user.baseSalary / 30 * 2).toFixed(2) : 0;
          }
        }

        if (!officialLeave && !leaveCompensation) {
          const filteredEntries = [];
          let lastTime = null;
          for (const entry of entries) {
            if (!lastTime || entry.dateTime.diff(lastTime, 'seconds').seconds >= 60) {
              filteredEntries.push(entry.dateTime);
              lastTime = entry.dateTime;
            }
          }

          if (filteredEntries.length === 1) {
            isSingleFingerprint = true;
            const entry = filteredEntries[0];
            if (entry.hour < 12) {
              checkIn = entry.toJSDate();
            } else {
              checkOut = entry.toJSDate();
            }
          } else if (filteredEntries.length > 1) {
            checkIn = filteredEntries[0].toJSDate();
            checkOut = filteredEntries[filteredEntries.length - 1].toJSDate();
          }
        }

        console.log(`Processing group ${key}: checkIn=${checkIn}, checkOut=${checkOut}, officialLeave=${officialLeave}, leaveCompensation=${leaveCompensation}, isSingleFingerprint=${isSingleFingerprint}`);

        const existingReport = await Fingerprint.findOne({
          code,
          date: {
            $gte: DateTime.fromISO(dateKey, { zone: 'Africa/Cairo' }).startOf('day').toJSDate(),
            $lte: DateTime.fromISO(dateKey, { zone: 'Africa/Cairo' }).endOf('day').toJSDate(),
          },
        });

        const report = existingReport || new Fingerprint({
          code,
          employeeName: user ? user.fullName : 'غير معروف',
          checkIn,
          checkOut,
          workHours: isSingleFingerprint ? 9 : 0,
          overtime: 0,
          lateMinutes: 0,
          lateDeduction: 0,
          earlyLeaveDeduction: 0,
          absence: false,
          annualLeave: false,
          medicalLeave: false,
          officialLeave,
          leaveCompensation,
          date: entries[0].dateTime.toJSDate(),
          workDaysPerWeek: user ? user.workDaysPerWeek : 6,
          isSingleFingerprint,
          customAnnualLeave: user ? user.customAnnualLeave : 0,
          annualLeaveBalance: user ? user.annualLeaveBalance : 21,
          advances: user ? user.advances : 0,
        });

        if (existingReport) {
          // تحديث التقرير الموجود
          existingReport.checkIn = checkIn;
          existingReport.checkOut = checkOut;
          existingReport.workHours = isSingleFingerprint ? 9 : 0;
          existingReport.officialLeave = officialLeave;
          existingReport.leaveCompensation = leaveCompensation;
          console.log(`Updating report for code ${code} on ${dateKey}`);
        } else {
          console.log(`Creating new report for code ${code} on ${dateKey}: employeeName=${report.employeeName}, workDaysPerWeek=${report.workDaysPerWeek}, officialLeave=${report.officialLeave}, leaveCompensation=${report.leaveCompensation}, isSingleFingerprint=${report.isSingleFingerprint}`);
        }

        try {
          await report.calculateAttendance();
          await report.save();
          if (!existingReport) {
            reports.push(report);
          }
        } catch (err) {
          console.error(`Error calculating attendance for code ${code} on ${dateKey}:`, err.message);
          // لا تزال التقارير تُنشأ حتى لو فشل calculateAttendance
          if (!existingReport) {
            reports.push(report);
          }
        }
      } catch (err) {
        console.error(`Error processing group ${key}:`, err.message);
      }
    }

    if (reports.length === 0) {
      console.error('No valid reports generated from the file');
      throw new Error('لا توجد بيانات صالحة في الملف');
    }

    console.log('Generated reports:', reports.length);
    return reports;
  } catch (error) {
    console.error('Error in parseFingerprintFile:', error.message);
    throw new Error(`خطأ في تحليل الملف: ${error.message}`);
  }
};
