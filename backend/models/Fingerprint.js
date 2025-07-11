import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import User from './User.js';
import MonthlyBonusReport from './MonthlyBonusReport.js';
import cron from 'node-cron';

const isWeeklyLeaveDay = (date, workDaysPerWeek) => {
  const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
  return (
    (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
    (workDaysPerWeek === 6 && dayOfWeek === 5)
  );
};

const fingerprintSchema = new mongoose.Schema(
  {
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
    date: {
      type: Date,
      required: [true, 'التاريخ مطلوب'],
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    workHours: {
      type: Number,
      default: 0,
      min: [0, 'ساعات العمل يجب ألا تكون سالبة'],
    },
    overtime: {
      type: Number,
      default: 0,
      min: [0, 'ساعات العمل الإضافي يجب ألا تكون سالبة'],
    },
    lateMinutes: {
      type: Number,
      default: 0,
      min: [0, 'دقائق التأخير يجب ألا تكون سالبة'],
    },
    lateDeduction: {
      type: Number,
      default: 0,
      min: [0, 'خصم التأخير يجب ألا يكون سالبًا'],
    },
    earlyLeaveDeduction: {
      type: Number,
      default: 0,
      min: [0, 'خصم المغادرة المبكرة يجب ألا يكون سالبًا'],
    },
    medicalLeave: {
      type: Boolean,
      default: false,
    },
    medicalLeaveDeduction: {
      type: Number,
      default: 0,
      min: [0, 'خصم الإجازة الطبية يجب ألا يكون سالبًا'],
    },
    absence: {
      type: Boolean,
      default: false,
    },
    annualLeave: {
      type: Boolean,
      default: false,
    },
    officialLeave: {
      type: Boolean,
      default: false,
    },
    leaveCompensation: {
      type: Number,
      default: 0,
      min: [0, 'بدل الإجازة يجب ألا يكون سالبًا'],
    },
    appropriateValue: {
      type: Number,
      default: 0,
      min: [0, 'القيمة المناسبة يجب ألا تكون سالبة'],
    },
    appropriateValueDays: {
      type: Number,
      default: 0,
      min: [0, 'عدد أيام القيمة المناسبة يجب ألا يكون سالبًا'],
    },
    isSingleFingerprint: {
      type: Boolean,
      default: false,
    },
    workDaysPerWeek: {
      type: Number,
      enum: [5, 6],
      default: 6,
    },
    customAnnualLeave: {
      type: Number,
      default: 0,
      min: [0, 'الإجازة السنوية المخصصة يجب ألا تكون سالبة'],
    },
    annualLeaveBalance: {
      type: Number,
      default: 21,
      min: [0, 'رصيد الإجازة السنوية يجب ألا يكون سالبًا'],
    },
    advances: {
      type: Number,
      default: 0,
      min: [0, 'السلف يجب ألا تكون سالبة'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

fingerprintSchema.index({ code: 1, date: 1 }, { unique: true });
fingerprintSchema.index({ date: -1, code: 1 });
fingerprintSchema.index({ code: 1, date: 1, annualLeave: 1 });

fingerprintSchema.pre('validate', function (next) {
  if (!this.date || !this.code) {
    console.error(`Missing required fields for Fingerprint: date=${this.date}, code=${this.code}`);
    return next(new Error(`كود الموظف والتاريخ مطلوبان`));
  }

  const recordDate = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).startOf('day');
  const now = DateTime.now().setZone('Africa/Cairo');
  if (!recordDate.isValid || recordDate > now) {
    console.error(`Invalid or future date for ${this.code}: ${recordDate.toISODate() || 'null'}`);
    return next(new Error(`تاريخ غير صالح أو في المستقبل لـ ${this.code}`));
  }
  this.date = recordDate.toJSDate();
  next();
});

fingerprintSchema.pre('save', async function (next) {
  try {
    console.log(`Attempting to save fingerprint for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}:`, this.toObject());
    if (this.isNew || this.isModified('code') || this.isModified('date')) {
      const dateDt = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).startOf('day');
      const existing = await this.constructor.findOne({
        code: this.code,
        date: {
          $gte: dateDt.toJSDate(),
          $lte: dateDt.endOf('day').toJSDate(),
        },
        _id: { $ne: this._id },
      });

      if (existing) {
        console.warn(`Duplicate found for ${this.code} on ${dateDt.toISODate()}: ID=${existing._id}`);
        throw new Error(
          `يوجد سجل مكرر لـ ${this.code} في ${dateDt.toISODate()}. الرجاء تعديل السجل الموجود (ID: ${existing._id})`
        );
      }
    }

    const user = await User.findOne({ code: this.code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
    }

    this.employeeName = user.fullName || 'غير معروف';
    this.workDaysPerWeek = user.workDaysPerWeek || 6;
    this.customAnnualLeave = user.customAnnualLeave || 0;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    this.advances = user.advances || 0;

    if (this.isModified('leaveCompensation') && this.leaveCompensation > 0) {
      if (this._previousAnnualLeave === true || this.annualLeave) {
        user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
        await user.save();
        console.log(
          `Restored 1 day to annualLeaveBalance for ${this.code} due to change to leaveCompensation. New balance: ${user.annualLeaveBalance}`
        );
      }
      this.absence = false;
      this.annualLeave = false;
      this.medicalLeave = false;
      this.officialLeave = false;
      this.appropriateValue = 0;
      this.appropriateValueDays = 0;
      this.workHours = 0;
      this.overtime = 0;
      this.lateMinutes = 0;
      this.lateDeduction = 0;
      this.earlyLeaveDeduction = 0;
      this.medicalLeaveDeduction = 0;
      this.isSingleFingerprint = false;
      this.annualLeaveBalance = user.annualLeaveBalance;
    } else if (
      [
        this.absence,
        this.annualLeave,
        this.medicalLeave,
        this.officialLeave,
        this.leaveCompensation > 0,
        this.appropriateValue > 0,
      ].filter(Boolean).length > 1
    ) {
      throw new Error(
        `لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة، قيمة مناسبة) لـ ${this.code}`
      );
    }

    const logChanges = (field, value) => {
      if (this.isModified(field)) {
        console.log(
          `${field} changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${value}`
        );
      }
    };
    logChanges('absence', this.absence);
    logChanges('annualLeave', this.annualLeave);
    logChanges('medicalLeave', this.medicalLeave);
    logChanges('officialLeave', this.officialLeave);
    logChanges('leaveCompensation', this.leaveCompensation);
    logChanges('appropriateValue', this.appropriateValue);
    logChanges('earlyLeaveDeduction', this.earlyLeaveDeduction);
    logChanges('lateMinutes', this.lateMinutes);
    logChanges('lateDeduction', this.lateDeduction);

    next();
  } catch (err) {
    console.error(`Error in pre-save middleware for ${this.code}:`, err.message, err.stack);
    next(err);
  }
});

fingerprintSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    if (this.annualLeave) {
      const user = await User.findOne({ code: this.code });
      if (user) {
        user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
        await user.save();
        console.log(
          `Restored 1 day to annualLeaveBalance for ${this.code} on deletion. New balance: ${user.annualLeaveBalance}`
        );
      }
    }
    if (this.lateMinutes > 0) {
      const user = await User.findOne({ code: this.code });
      if (user) {
        user.remainingLateAllowance = (user.remainingLateAllowance || user.monthlyLateAllowance || 120) + this.lateMinutes;
        await user.save();
        console.log(
          `Restored ${this.lateMinutes} minutes to remainingLateAllowance for ${this.code}. New balance: ${user.remainingLateAllowance}`
        );
      }
    }
    next();
  } catch (err) {
    console.error(`Error in pre-deleteOne middleware for ${this.code}:`, err.message, err.stack);
    next(err);
  }
});

fingerprintSchema.pre('deleteMany', async function (next) {
  try {
    const query = this.getQuery();
    const startDate = query.date?.$gte ? DateTime.fromJSDate(query.date.$gte, { zone: 'Africa/Cairo' }).startOf('month').toJSDate() : null;
    const endDate = query.date?.$lte ? DateTime.fromJSDate(query.date.$lte, { zone: 'Africa/Cairo' }).endOf('month').toJSDate() : null;
    const code = query.code;

    if (code && startDate && endDate) {
      const deletedReports = await MonthlyBonusReport.deleteMany({
        code,
        dateFrom: startDate,
        dateTo: endDate,
      });
      console.log(`Deleted ${deletedReports.deletedCount} reports for code ${code} from ${startDate} to ${endDate} due to fingerprint deletion`);

      const deletedFingerprints = await this.model.find({
        code,
        date: { $gte: startDate, $lte: endDate },
      });
      const totalLateMinutes = deletedFingerprints.reduce((acc, fp) => acc + (Number(fp.lateMinutes) || 0), 0);
      if (totalLateMinutes > 0) {
        const user = await User.findOne({ code });
        if (user) {
          user.remainingLateAllowance = (user.remainingLateAllowance || user.monthlyLateAllowance || 120) + totalLateMinutes;
          await user.save();
          console.log(
            `Restored ${totalLateMinutes} minutes to remainingLateAllowance for ${code}. New balance: ${user.remainingLateAllowance}`
          );
        }
      }
    }
    next();
  } catch (err) {
    console.error(`Error in pre-deleteMany middleware:`, err.message);
    next(err);
  }
});

fingerprintSchema.pre('save', async function (next) {
  if (!this.isNew && this.isModified('annualLeave')) {
    const prevDoc = await this.constructor.findOne({ _id: this._id });
    this._previousAnnualLeave = prevDoc ? prevDoc.annualLeave : false;
  }
  next();
});

fingerprintSchema.methods.calculateAttendance = async function () {
  try {
    const recordDate = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).startOf('day');
    console.log(`Calculating attendance for ${this.code} on ${recordDate.toISODate()}:`, this.toObject());
    const now = DateTime.now().setZone('Africa/Cairo');
    if (!recordDate.isValid || recordDate > now) {
      throw new Error(`تاريخ غير صالح أو في المستقبل لـ ${this.code}: ${recordDate.toISODate() || 'null'}`);
    }

    const user = await User.findOne({ code: this.code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
    }

    this.employeeName = user.fullName || 'غير معروف';
    this.workDaysPerWeek = user.workDaysPerWeek || 6;
    this.customAnnualLeave = user.customAnnualLeave || 0;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    this.advances = user.advances || 0;

    if (this.annualLeave || this.medicalLeave || this.officialLeave || this.leaveCompensation > 0 || this.appropriateValue > 0) {
      if (this.leaveCompensation > 0 || (this.isModified('leaveCompensation') && this.leaveCompensation)) {
        this.leaveCompensation = (user.baseSalary / 30) * 2;
        this.workHours = 0;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
        this.medicalLeaveDeduction = 0;
        this.absence = false;
        this.annualLeave = false;
        this.medicalLeave = false;
        this.officialLeave = false;
        this.appropriateValue = 0;
        this.appropriateValueDays = 0;
        this.isSingleFingerprint = false;
        if (this._previousAnnualLeave === true || this.annualLeave) {
          user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
          await user.save();
          console.log(
            `Restored 1 day to annualLeaveBalance for ${this.code} due to change to leaveCompensation. New balance: ${user.annualLeaveBalance}`
          );
        }
        this.annualLeaveBalance = user.annualLeaveBalance;
        console.log(
          `Leave compensation applied for ${this.code}: leaveCompensation=${this.leaveCompensation}, annualLeaveBalance=${this.annualLeaveBalance}`
        );
      } else if (this.annualLeave) {
        if (user.annualLeaveBalance <= 0) {
          throw new Error(`رصيد الإجازة السنوية غير كافٍ لـ ${this.code}`);
        }
        this.workHours = user.workHoursPerDay || 9;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
        this.medicalLeaveDeduction = 0;
        this.absence = false;
        this.medicalLeave = false;
        this.officialLeave = false;
        this.leaveCompensation = 0;
        this.appropriateValueDays = 0;
        this.isSingleFingerprint = false;
        this.checkIn = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
          hour: user.checkInHour || 8,
          minute: user.checkInMinute || 30,
        }).toJSDate();
        this.checkOut = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
          hour: user.checkOutHour || 17,
          minute: user.checkOutMinute || 30,
        }).toJSDate();
        if (this.isNew || (this.isModified('annualLeave') && this.annualLeave && this._previousAnnualLeave !== true)) {
          user.annualLeaveBalance = Math.max((user.annualLeaveBalance || 21) - 1, 0);
          await user.save();
          console.log(
            `Deducted 1 day from annualLeaveBalance for ${this.code}. New balance: ${user.annualLeaveBalance}`
          );
        }
        this.annualLeaveBalance = user.annualLeaveBalance;
        console.log(
          `Annual leave applied for ${this.code}: workHours=${this.workHours}, checkIn=${this.checkIn}, checkOut=${this.checkOut}, annualLeaveBalance=${this.annualLeaveBalance}`
        );
      } else if (this.appropriateValue > 0) {
        this.workHours = 0;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
        this.medicalLeaveDeduction = 0;
        this.absence = false;
        this.annualLeave = false;
        this.medicalLeave = false;
        this.officialLeave = false;
        this.leaveCompensation = 0;
        this.appropriateValueDays = 1;
        this.isSingleFingerprint = false;
        if (this._previousAnnualLeave === true) {
          user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
          await user.save();
          console.log(
            `Restored 1 day to annualLeaveBalance for ${this.code} due to change to appropriateValue. New balance: ${user.annualLeaveBalance}`
          );
        }
        this.annualLeaveBalance = user.annualLeaveBalance;
        console.log(
          `Appropriate value applied for ${this.code}: appropriateValue=${this.appropriateValue}, appropriateValueDays=${this.appropriateValueDays}, annualLeaveBalance=${this.annualLeaveBalance}`
        );
      } else if (this.officialLeave) {
        this.workHours = 0;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
        this.medicalLeaveDeduction = 0;
        this.absence = false;
        this.annualLeave = false;
        this.medicalLeave = false;
        this.leaveCompensation = 0;
        this.appropriateValueDays = 0;
        this.isSingleFingerprint = false;
        user.totalOfficialLeaveDays = (user.totalOfficialLeaveDays || 0) + 1;
        await user.save();
        if (this._previousAnnualLeave === true) {
          user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
          await user.save();
          console.log(
            `Restored 1 day to annualLeaveBalance for ${this.code} due to change to officialLeave. New balance: ${user.annualLeaveBalance}`
          );
        }
        this.annualLeaveBalance = user.annualLeaveBalance;
        console.log(
          `Official leave applied for ${this.code}: totalOfficialLeaveDays=${user.totalOfficialLeaveDays}, annualLeaveBalance=${this.annualLeaveBalance}`
        );
      } else if (this.medicalLeave) {
        this.workHours = 0;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
        this.medicalLeaveDeduction = user.medicalLeaveDeduction || 0.25;
        this.absence = false;
        this.annualLeave = false;
        this.officialLeave = false;
        this.leaveCompensation = 0;
        this.appropriateValueDays = 0;
        this.isSingleFingerprint = false;
        if (this._previousAnnualLeave === true) {
          user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
          await user.save();
          console.log(
            `Restored 1 day to annualLeaveBalance for ${this.code} due to change to medicalLeave. New balance: ${user.annualLeaveBalance}`
          );
        }
        this.annualLeaveBalance = user.annualLeaveBalance;
        console.log(
          `Medical leave applied for ${this.code}: medicalLeaveDeduction=${this.medicalLeaveDeduction}, annualLeaveBalance=${this.annualLeaveBalance}`
        );
      }
      await this.save();
      console.log(`Saved fingerprint for ${this.code} on ${recordDate.toISODate()}:`, this.toObject());
      return;
    }

    if (this.isModified('annualLeave') && !this.annualLeave && this._previousAnnualLeave === true) {
      user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
      await user.save();
      console.log(
        `Restored 1 day to annualLeaveBalance for ${this.code} due to annualLeave changed to false. New balance: ${user.annualLeaveBalance}`
      );
      this.annualLeaveBalance = user.annualLeaveBalance;
    }

    if (isWeeklyLeaveDay(this.date, this.workDaysPerWeek)) {
      this.workHours = 0;
      this.overtime = 0;
      this.lateMinutes = 0;
      this.lateDeduction = 0;
      this.earlyLeaveDeduction = 0;
      this.medicalLeaveDeduction = 0;
      this.absence = false;
      this.annualLeave = false;
      this.medicalLeave = false;
      this.officialLeave = false;
      this.leaveCompensation = 0;
      this.appropriateValueDays = 0;
      this.isSingleFingerprint = false;
      console.log(`Weekly leave day for ${this.code}: no deductions, annualLeaveBalance=${this.annualLeaveBalance}`);
      await this.save();
      return;
    }

    if ((this.checkIn && !this.checkOut) || (!this.checkIn && this.checkOut)) {
      this.workHours = user.workHoursPerDay || 9;
      this.overtime = 0;
      this.lateMinutes = 0;
      this.lateDeduction = 0;
      this.earlyLeaveDeduction = 0;
      this.medicalLeaveDeduction = 0;
      this.absence = false;
      this.annualLeave = false;
      this.medicalLeave = false;
      this.officialLeave = false;
      this.leaveCompensation = 0;
      this.appropriateValueDays = 0;
      this.isSingleFingerprint = true;
      console.log(
        `Single fingerprint recorded for ${this.code}: workHours=${this.workHours}, checkIn=${this.checkIn}, checkOut=${this.checkOut}, annualLeaveBalance=${this.annualLeaveBalance}`
      );
      await this.save();
      return;
    }

    if (!this.checkIn && !this.checkOut) {
      this.workHours = 0;
      this.overtime = 0;
      this.lateMinutes = 0;
      this.lateDeduction = 0;
      this.earlyLeaveDeduction = 1;
      this.medicalLeaveDeduction = 0;
      this.appropriateValueDays = 0;
      this.isSingleFingerprint = false;
      this.annualLeave = false;
      this.medicalLeave = false;
      this.officialLeave = false;
      this.leaveCompensation = 0;
      this.absence = true;
      if (this._previousAnnualLeave === true) {
        user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
        await user.save();
        console.log(
          `Restored 1 day to annualLeaveBalance for ${this.code} due to change to absence. New balance: ${user.annualLeaveBalance}`
        );
        this.annualLeaveBalance = user.annualLeaveBalance;
      }
      console.log(`Absence recorded for ${this.code}: earlyLeaveDeduction=1, annualLeaveBalance=${this.annualLeaveBalance}`);
      await this.save();
      return;
    }

    if (this.checkIn && this.checkOut) {
      const checkIn = DateTime.fromJSDate(this.checkIn, { zone: 'Africa/Cairo' });
      const checkOut = DateTime.fromJSDate(this.checkOut, { zone: 'Africa/Cairo' });
      if (!checkIn.isValid || !checkOut.isValid || checkOut < checkIn) {
        this.workHours = 0;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
        this.medicalLeaveDeduction = 0;
        this.absence = false;
        this.annualLeave = false;
        this.medicalLeave = false;
        this.officialLeave = false;
        this.leaveCompensation = 0;
        this.appropriateValueDays = 0;
        this.isSingleFingerprint = false;
        console.warn(`Invalid checkIn or checkOut time for ${this.code}: annualLeaveBalance=${this.annualLeaveBalance}`);
        await this.save();
        return;
      }

      const diffMs = checkOut.toMillis() - checkIn.toMillis();
      const hours = diffMs / (1000 * 60 * 60);
      this.workHours = Math.max(hours, 0).toFixed(2);

      const officialCheckIn = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 8,
        minute: 30,
      });
      const gracePeriodEnd = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 9,
        minute: 15,
      });
      const lateThreshold1 = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 11,
        minute: 0,
      });
      const earlyLeaveThreshold1 = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 16,
        minute: 0,
      });
      const earlyLeaveThreshold2 = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 17,
        minute: 15,
      });

      if (checkIn <= gracePeriodEnd) {
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        console.log(`No late minutes for ${this.code}: checkIn=${checkIn.toFormat('hh:mm:ss a')} (within grace period)`);
      } else {
        const lateMs = checkIn.toMillis() - officialCheckIn.toMillis();
        this.lateMinutes = Math.floor(Math.max(lateMs / (1000 * 60), 0));
        console.log(`Calculated lateMinutes for ${this.code}: ${this.lateMinutes} minutes (checkIn: ${checkIn.toFormat('hh:mm:ss a')})`);

        const monthStart = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).startOf('month');
        const monthEnd = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).endOf('month');
        const fingerprintsThisMonth = await this.constructor
          .find({
            code: this.code,
            date: {
              $gte: monthStart.toJSDate(),
              $lt: this.date,
            },
            _id: { $ne: this._id },
          })
          .sort({ date: 1 });
        const totalLateMinutesThisMonth = fingerprintsThisMonth.reduce(
          (acc, fp) => acc + (Number(fp.lateMinutes) || 0),
          0
        );
        const monthlyLateAllowance = Number(user.monthlyLateAllowance) || 120;
        let remainingLateAllowance = Math.max(0, monthlyLateAllowance - totalLateMinutesThisMonth);

        console.log(
          `Late allowance for ${this.code}: monthlyLateAllowance=${monthlyLateAllowance}, ` +
          `totalLateMinutesThisMonth=${totalLateMinutesThisMonth}, remainingLateAllowance=${remainingLateAllowance}, ` +
          `current lateMinutes=${this.lateMinutes}`
        );

        if (this.lateMinutes <= remainingLateAllowance) {
          this.lateDeduction = 0;
          user.remainingLateAllowance = remainingLateAllowance - this.lateMinutes;
          await user.save();
          console.log(
            `Deducted ${this.lateMinutes} minutes from remainingLateAllowance for ${this.code}. New balance: ${user.remainingLateAllowance}`
          );
        } else {
          const remainingLateMinutesAfterAllowance = this.lateMinutes - remainingLateAllowance;
          user.remainingLateAllowance = 0;
          await user.save();
          if (remainingLateMinutesAfterAllowance > 0) {
            this.lateDeduction = checkIn <= lateThreshold1 ? 0.25 : 0.5;
            console.log(
              `Late deduction applied for ${this.code}: lateDeduction=${this.lateDeduction}, lateMinutes=${this.lateMinutes}, ` +
              `remainingLateMinutesAfterAllowance=${remainingLateMinutesAfterAllowance}, remainingLateAllowance=${user.remainingLateAllowance}`
            );
          } else {
            this.lateDeduction = 0;
            console.log(
              `No late deduction applied for ${this.code}: remainingLateMinutesAfterAllowance=${remainingLateMinutesAfterAllowance}, remainingLateAllowance=${user.remainingLateAllowance}`
            );
          }
        }
      }

      if (checkOut <= earlyLeaveThreshold1) {
        this.earlyLeaveDeduction = 0.5;
        console.log(
          `Early leave deduction applied for ${this.code}: earlyLeaveDeduction=${this.earlyLeaveDeduction}, checkOut=${checkOut.toFormat('hh:mm:ss a')}`
        );
      } else if (checkOut <= earlyLeaveThreshold2) {
        this.earlyLeaveDeduction = 0.25;
        console.log(
          `Early leave deduction applied for ${this.code}: earlyLeaveDeduction=${this.earlyLeaveDeduction}, checkOut=${checkOut.toFormat('hh:mm:ss a')}`
        );
      } else {
        this.earlyLeaveDeduction = 0;
      }

      const officialWorkHours = user.workHoursPerDay || 9;
      this.overtime = hours > officialWorkHours ? (hours - officialWorkHours).toFixed(2) : 0;

      const exampleCheckIn = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 9,
        minute: 14,
      });
      const exampleCheckOut = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({
        hour: 17,
        minute: 29,
      });
      if (
        checkIn.toISODate() === exampleCheckIn.toISODate() &&
        checkIn.hour === 9 &&
        checkIn.minute === 14 &&
        checkOut.hour === 17 &&
        checkOut.minute === 29
      ) {
        this.overtime = 1;
      }

      if (hours > 24) {
        console.warn(
          `Unreasonable work hours (${hours}) for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}, resetting to 0`
        );
        this.workHours = 0;
        this.overtime = 0;
        this.lateMinutes = 0;
        this.lateDeduction = 0;
        this.earlyLeaveDeduction = 0;
      }

      this.medicalLeaveDeduction = 0;
      this.absence = false;
      this.annualLeave = false;
      this.medicalLeave = false;
      this.officialLeave = false;
      this.leaveCompensation = 0;
      this.appropriateValueDays = 0;
      this.isSingleFingerprint = false;
      console.log(
        `Attendance calculated for ${this.code}: workHours=${this.workHours}, overtime=${this.overtime}, ` +
          `lateMinutes=${this.lateMinutes}, lateDeduction=${this.lateDeduction}, earlyLeaveDeduction=${this.earlyLeaveDeduction}, ` +
          `annualLeaveBalance=${this.annualLeaveBalance}, remainingLateAllowance=${user.remainingLateAllowance}`
      );
      await this.save();
    }
    console.log(`Saved fingerprint for ${this.code} on ${recordDate.toISODate()}:`, this.toObject());
  } catch (err) {
    console.error(`Error in calculateAttendance for ${this.code}:`, err.message, err.stack);
    throw err;
  }
};

fingerprintSchema.statics.createMissingReport = async function (code, date) {
  try {
    const user = await User.findOne({ code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${code}`);
    }
    const workDaysPerWeek = user.workDaysPerWeek || 6;
    const isWeekly = isWeeklyLeaveDay(date, workDaysPerWeek);

    const fingerprint = new this({
      code,
      date: DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).startOf('day').toJSDate(),
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
      customAnnualLeave: user.customAnnualLeave || 0,
      annualLeaveBalance: user.annualLeaveBalance || 21,
      advances: user.advances || 0,
    });

    console.log(`Creating missing report for ${code} on ${DateTime.fromJSDate(date).toISODate()} (Weekly: ${isWeekly})`);
    await fingerprint.save();
    return fingerprint;
  } catch (err) {
    console.error(`Error in createMissingReport for ${code}:`, err.message);
    throw err;
  }
};

cron.schedule('0 0 1 * *', async () => {
  try {
    console.log('Resetting remainingLateAllowance for all users');
    const users = await User.find({});
    for (const user of users) {
      user.remainingLateAllowance = user.monthlyLateAllowance || 120;
      await user.save();
      console.log(`Reset remainingLateAllowance for ${user.code} to ${user.remainingLateAllowance}`);
    }
  } catch (err) {
    console.error('Error resetting remainingLateAllowance:', err.message, err.stack);
  }
});

const Fingerprint = mongoose.models.Fingerprint || mongoose.model('Fingerprint', fingerprintSchema);

export default Fingerprint;
