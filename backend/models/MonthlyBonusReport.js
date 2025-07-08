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
    min: [0, 'عدد أيام الإجازة السنوية يجب ألا تكون سالبًا'],
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

// دالة لحساب صافي المكافأة
const calculateNetBonus = (baseBonus, bonusPercentage, absences, tieUpValue, productionValue, advances, deductions) => {
  const bonus = Number(baseBonus || 0) * (Number(bonusPercentage || 0) / 100);
  const dailyBonus = bonus / 30;
  const absenceDeduction = Number(absences || 0) * dailyBonus;
  const adjustedBonus = bonus - absenceDeduction;
  const netBonus = adjustedBonus + Number(tieUpValue || 0) + Number(productionValue || 0) - Number(advances || 0) - Number(deductions || 0);
  return Math.max(0, netBonus).toFixed(2);
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

    // جلب بيانات الحضور من Fingerprint
    const fingerprints = await Fingerprint.find({
      code: this.code,
      date: { $gte: startDate.toJSDate(), $lte: endDate.toJSDate() },
    });

    // حساب أيام العمل والغياب والإجازات
    const workDaysPerWeek = this.workDaysPerWeek || 6;
    const isWeeklyLeaveDay = (date) => {
      const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
      return (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
             (workDaysPerWeek === 6 && dayOfWeek === 5);
    };

    this.totalWorkDays = fingerprints.reduce((acc, fp) => {
      const isWorkDay = !fp.absence &&
                        !fp.annualLeave &&
                        !fp.medicalLeave &&
                        !fp.officialLeave &&
                        fp.leaveCompensation === 0 &&
                        fp.appropriateValue === 0 &&
                        !isWeeklyLeaveDay(fp.date);
      return acc + (isWorkDay ? 1 : 0);
    }, 0);

    this.absences = fingerprints.reduce((acc, fp) => acc + (fp.absence ? 1 : 0), 0);
    this.annualLeave = fingerprints.reduce((acc, fp) => acc + (fp.annualLeave ? 1 : 0), 0);
    this.totalLeaveDays = fingerprints.reduce((acc, fp) => {
      return acc + (fp.annualLeave || fp.medicalLeave || fp.officialLeave || fp.leaveCompensation ? 1 : 0);
    }, 0);

    // التحقق من القيم الرقمية
    if (this.tieUpValue < 0) throw new Error('قيمة التربيط يجب ألا تكون سالبة');
    if (this.productionValue < 0) throw new Error('قيمة الإنتاج يجب ألا تكون سالبة');
    if (this.advances < 0) throw new Error('السلف يجب ألا تكون سالبة');
    if (this.deductions < 0) throw new Error('الاستقطاعات يجب ألا تكون سالبة');

    // حساب صافي المكافأة
    this.netBonus = calculateNetBonus(
      this.baseBonus,
      this.bonusPercentage,
      this.absences,
      this.tieUpValue,
      this.productionValue,
      this.advances,
      this.deductions
    );

    console.log(`Calculated attendance and netBonus for report ${this.code}: totalWorkDays=${this.totalWorkDays}, absences=${this.absences}, annualLeave=${this.annualLeave}, totalLeaveDays=${this.totalLeaveDays}, netBonus=${this.netBonus}`);
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

    // التحقق من وجود التقرير
    const existingReport = await this.model.findOne({
      code: query.code,
      dateFrom: startDate.toJSDate(),
      dateTo: endDate.toJSDate(),
    });

    if (!existingReport) {
      throw new Error(`التقرير غير موجود لكود ${query.code} من ${startDate.toISODate()} إلى ${endDate.toISODate()}`);
    }

    // جلب بيانات الموظف
    const user = await User.findOne({ code: query.code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${query.code}`);
    }

    // التحقق من القيم الرقمية
    if (update.$set) {
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
    }

    // جلب بيانات الحضور من Fingerprint
    const fingerprints = await Fingerprint.find({
      code: query.code,
      date: { $gte: startDate.toJSDate(), $lte: endDate.toJSDate() },
    });

    // حساب أيام العمل والغياب والإجازات
    const workDaysPerWeek = user.workDaysPerWeek || existingReport.workDaysPerWeek || 6;
    const isWeeklyLeaveDay = (date) => {
      const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
      return (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
             (workDaysPerWeek === 6 && dayOfWeek === 5);
    };

    const totalWorkDays = fingerprints.reduce((acc, fp) => {
      const isWorkDay = !fp.absence &&
                        !fp.annualLeave &&
                        !fp.medicalLeave &&
                        !fp.officialLeave &&
                        fp.leaveCompensation === 0 &&
                        fp.appropriateValue === 0 &&
                        !isWeeklyLeaveDay(fp.date);
      return acc + (isWorkDay ? 1 : 0);
    }, 0);

    const absences = fingerprints.reduce((acc, fp) => acc + (fp.absence ? 1 : 0), 0);
    const annualLeave = fingerprints.reduce((acc, fp) => acc + (fp.annualLeave ? 1 : 0), 0);
    const totalLeaveDays = fingerprints.reduce((acc, fp) => {
      return acc + (fp.annualLeave || fp.medicalLeave || fp.officialLeave || fp.leaveCompensation ? 1 : 0);
    }, 0);

    // تحديث الحقول
    if (update.$set) {
      update.$set.totalWorkDays = totalWorkDays;
      update.$set.absences = absences;
      update.$set.annualLeave = annualLeave;
      update.$set.totalLeaveDays = totalLeaveDays;
      update.$set.employeeName = user.fullName || existingReport.employeeName || 'غير معروف';
      update.$set.department = user.department || existingReport.department || '';
      update.$set.baseBonus = Number(user.baseBonus || existingReport.baseBonus || 0);
      update.$set.bonusPercentage = Number(user.bonusPercentage || existingReport.bonusPercentage || 0);
      update.$set.workDaysPerWeek = Number(user.workDaysPerWeek || existingReport.workDaysPerWeek || 6);

      // حساب صافي المكافأة
      update.$set.netBonus = calculateNetBonus(
        update.$set.baseBonus || existingReport.baseBonus || user.baseBonus || 0,
        update.$set.bonusPercentage || existingReport.bonusPercentage || user.bonusPercentage || 0,
        absences,
        update.$set.tieUpValue !== undefined ? Number(update.$set.tieUpValue) : existingReport.tieUpValue,
        update.$set.productionValue !== undefined ? Number(update.$set.productionValue) : existingReport.productionValue,
        update.$set.advances !== undefined ? Number(update.$set.advances) : existingReport.advances || user.advances || 0,
        update.$set.deductions !== undefined ? Number(update.$set.deductions) : existingReport.deductions || 0
      );
    }

    console.log(`Pre-update calculated for code ${query.code} from ${startDate.toISODate()} to ${endDate.toISODate()}: totalWorkDays=${totalWorkDays}, absences=${absences}, annualLeave=${annualLeave}, totalLeaveDays=${totalLeaveDays}, netBonus=${update.$set.netBonus}`);
    next();
  } catch (err) {
    console.error(`Error in pre-update middleware for code ${query.code}:`, err.message);
    next(err);
  }
});

const MonthlyBonusReport = mongoose.models.MonthlyBonusReport || mongoose.model('MonthlyBonusReport', monthlyBonusReportSchema);

export default MonthlyBonusReport;
