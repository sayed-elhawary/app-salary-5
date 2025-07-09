// backend/models/MonthlyBonusReport.js
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import User from './User.js';
import Fingerprint from './Fingerprint.js';

const monthlyBonusReportSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'كود الموظف مطلوب'],
    trim: true,
  },
  employeeName: {
    type: String,
    required: [true, 'اسم الموظف مطلوب'],
    trim: true,
  },
  department: {
    type: String,
    default: '',
  },
  baseBonus: {
    type: Number,
    default: 0,
    min: [0, 'المكافأة الأساسية يجب ألا تكون سالبة'],
  },
  bonusPercentage: {
    type: Number,
    default: 0,
    min: [0, 'نسبة المكافأة يجب ألا تكون سالبة'],
  },
  workDaysPerWeek: {
    type: Number,
    enum: [5, 6],
    default: 6,
  },
  totalWorkDays: {
    type: Number,
    default: 0,
    min: [0, 'إجمالي أيام العمل يجب ألا يكون سالبًا'],
  },
  absences: {
    type: Number,
    default: 0,
    min: [0, 'عدد أيام الغياب يجب ألا يكون سالبًا'],
  },
  annualLeave: {
    type: Number,
    default: 0,
    min: [0, 'عدد أيام الإجازة السنوية يجب ألا يكون سالبًا'],
  },
  medicalLeave: {
    type: Number,
    default: 0,
    min: [0, 'عدد أيام الإجازة الطبية يجب ألا يكون سالبًا'],
  },
  totalLeaveDays: {
    type: Number,
    default: 0,
    min: [0, 'إجمالي أيام الإجازة يجب ألا يكون سالبًا'],
  },
  tieUpValue: {
    type: Number,
    default: 0,
    min: [0, 'قيمة التربيط يجب ألا تكون سالبة'],
  },
  productionValue: {
    type: Number,
    default: 0,
    min: [0, 'قيمة الإنتاج يجب ألا تكون سالبة'],
  },
  advances: {
    type: Number,
    default: 0,
    min: [0, 'السلف يجب ألا تكون سالبة'],
  },
  deductions: {
    type: Number,
    default: 0,
    min: [0, 'الاستقطاعات يجب ألا تكون سالبة'],
  },
  netBonus: {
    type: Number,
    default: 0,
    min: [0, 'صافي المكافأة يجب ألا يكون سالبًا'],
  },
  dateFrom: {
    type: Date,
    required: [true, 'تاريخ البداية مطلوب'],
  },
  dateTo: {
    type: Date,
    required: [true, 'تاريخ النهاية مطلوب'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'المستخدم الذي أنشأ التقرير مطلوب'],
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// فهرسة لضمان التفرد
monthlyBonusReportSchema.index({ code: 1, dateFrom: 1, dateTo: 1 }, { unique: true });

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

// التحقق قبل الحفظ
monthlyBonusReportSchema.pre('save', async function (next) {
  try {
    // تحديث بيانات الموظف
    if (this.isNew || this.isModified('code')) {
      const user = await User.findOne({ code: this.code });
      if (!user) {
        throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
      }
      this.employeeName = user.fullName || 'غير معروف';
      this.department = user.department || '';
      this.baseBonus = Number(user.baseBonus || 0);
      this.bonusPercentage = Number(user.bonusPercentage || 0);
      this.workDaysPerWeek = Number(user.workDaysPerWeek || 6);
      this.advances = Number(user.advances || 0);
      console.log(`Updated employee details for report ${this.code} from ${DateTime.fromJSDate(this.dateFrom).toISODate()} to ${DateTime.fromJSDate(this.dateTo).toISODate()}: employeeName=${this.employeeName}, department=${this.department}, baseBonus=${this.baseBonus}, bonusPercentage=${this.bonusPercentage}, workDaysPerWeek=${this.workDaysPerWeek}, advances=${this.advances}`);
    }

    // ضمان أن التواريخ في حدود الشهر
    const startDate = DateTime.fromJSDate(this.dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromJSDate(this.dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) {
      throw new Error('تاريخ البداية أو النهاية غير صالح');
    }
    if (startDate > endDate) {
      throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
    }
    this.dateFrom = startDate.toJSDate();
    this.dateTo = endDate.toJSDate();

    // تحديث بيانات الحضور
    const attendanceStats = await calculateAttendanceStats(this.code, startDate, endDate);
    this.totalWorkDays = attendanceStats.totalWorkDays;
    this.absences = attendanceStats.absences;
    this.annualLeave = attendanceStats.annualLeave;
    this.medicalLeave = attendanceStats.medicalLeave;
    this.totalLeaveDays = attendanceStats.totalLeaveDays;

    // التحقق من القيم الرقمية
    if (this.tieUpValue < 0) throw new Error('قيمة التربيط يجب ألا تكون سالبة');
    if (this.productionValue < 0) throw new Error('قيمة الإنتاج يجب ألا تكون سالبة');
    if (this.advances < 0) throw new Error('السلف يجب ألا تكون سالبة');
    if (this.deductions < 0) throw new Error('الاستقطاعات يجب ألا تكون سالبة');
    if (this.netBonus < 0) throw new Error('صافي المكافأة يجب ألا يكون سالبًا');

    console.log(`Calculated attendance for report ${this.code}: totalWorkDays=${this.totalWorkDays}, absences=${this.absences}, annualLeave=${this.annualLeave}, medicalLeave=${this.medicalLeave}, totalLeaveDays=${this.totalLeaveDays}, netBonus=${this.netBonus}`);
    next();
  } catch (err) {
    console.error(`Error in pre-save middleware for report ${this.code}:`, err.message);
    next(err);
  }
});

// التحقق قبل التحديث
monthlyBonusReportSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate();
    const query = this.getQuery();

    // ضمان أن التواريخ في حدود الشهر
    const startDate = DateTime.fromJSDate(query.dateFrom || update.$set?.dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromJSDate(query.dateTo || update.$set?.dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) {
      throw new Error('تاريخ البداية أو النهاية غير صالح');
    }
    if (startDate > endDate) {
      throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
    }

    // تحديث التواريخ في التحديث
    if (update.$set) {
      update.$set.dateFrom = startDate.toJSDate();
      update.$set.dateTo = endDate.toJSDate();
    }

    // جلب بيانات الموظف
    const user = await User.findOne({ code: query.code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${query.code}`);
    }

    // تحديث بيانات الحضور
    const attendanceStats = await calculateAttendanceStats(query.code, startDate, endDate);
    if (update.$set) {
      update.$set.totalWorkDays = attendanceStats.totalWorkDays;
      update.$set.absences = attendanceStats.absences;
      update.$set.annualLeave = attendanceStats.annualLeave;
      update.$set.medicalLeave = attendanceStats.medicalLeave;
      update.$set.totalLeaveDays = attendanceStats.totalLeaveDays;

      // تحديث بيانات الموظف إذا لزم الأمر
      update.$set.employeeName = user.fullName || 'غير معروف';
      update.$set.department = user.department || '';
      update.$set.baseBonus = Number(user.baseBonus || 0);
      update.$set.bonusPercentage = Number(user.bonusPercentage || 0);
      update.$set.workDaysPerWeek = Number(user.workDaysPerWeek || 6);
      update.$set.advances = Number(update.$set.advances || user.advances || 0);

      // التحقق من القيم الرقمية
      if (update.$set.tieUpValue !== undefined && Number(update.$set.tieUpValue) < 0) {
        throw new Error('قيمة التربيط يجب ألا تكون سالبة');
      }
      if (update.$set.productionValue !== undefined && Number(update.$set.productionValue) < 0) {
        throw new Error('قيمة الإنتاج يجب ألا تكون سالبة');
      }
      if (update.$set.advances !== undefined && Number(update.$set.advances) < 0) {
        throw new Error('السلف يجب ألا تكون سالبة');
      }
      if (update.$set.deductions !== undefined && Number(update.$set.deductions) < 0) {
        throw new Error('الاستقطاعات يجب ألا تكون سالبة');
      }
      if (update.$set.netBonus !== undefined && Number(update.$set.netBonus) < 0) {
        throw new Error('صافي المكافأة يجب ألا يكون سالبًا');
      }
    }

    console.log(`Updating report for code ${query.code} from ${startDate.toISODate()} to ${endDate.toISODate()}:`, update.$set);
    next();
  } catch (err) {
    console.error(`Error in pre-findOneAndUpdate middleware for report ${query.code}:`, err.message);
    next(err);
  }
});

const MonthlyBonusReport = mongoose.models.MonthlyBonusReport || mongoose.model('MonthlyBonusReport', monthlyBonusReportSchema);

export default MonthlyBonusReport;
