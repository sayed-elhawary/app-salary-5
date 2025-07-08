import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import User from './User.js';

// دالة للتحقق من الأيام الأسبوعية
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

// إعداد الفهرسة لضمان التفرد وتحسين الأداء
fingerprintSchema.index({ code: 1, date: 1 }, { unique: true });
fingerprintSchema.index({ date: -1, code: 1 });

// التحقق من التاريخ قبل الحفظ
fingerprintSchema.pre('validate', function (next) {
  if (!this.date || !this.code) {
    console.error(`Missing required fields for Fingerprint: date=${this.date}, code=${this.code}`);
    return next(new Error(`كود الموظف والتاريخ مطلوبان`));
  }

  const recordDate = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' });
  const now = DateTime.now().setZone('Africa/Cairo');
  if (!recordDate.isValid || recordDate > now) {
    console.error(`Invalid or future date for ${this.code}: ${recordDate.toISODate() || 'null'}`);
    return next(new Error(`تاريخ غير صالح أو في المستقبل لـ ${this.code}`));
  }
  next();
});

// التحقق قبل الحفظ
fingerprintSchema.pre('save', async function (next) {
  try {
    // التحقق من وجود سجل آخر بنفس الكود والتاريخ
    if (this.isNew || this.isModified('code') || this.isModified('date')) {
      const existing = await this.constructor.findOne({
        code: this.code,
        date: {
          $gte: DateTime.fromJSDate(this.date).startOf('day').toJSDate(),
          $lte: DateTime.fromJSDate(this.date).endOf('day').toJSDate(),
        },
        _id: { $ne: this._id },
      });

      if (existing) {
        console.warn(`Duplicate found for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}, merging...`);
        if (
          (existing.annualLeave || existing.medicalLeave || existing.officialLeave || existing.leaveCompensation > 0 || existing.appropriateValue > 0) &&
          (this.annualLeave || this.medicalLeave || this.officialLeave || this.leaveCompensation > 0 || this.appropriateValue > 0)
        ) {
          throw new Error(`يوم ${DateTime.fromJSDate(this.date).toISODate()} لـ ${this.code} مسجل مسبقًا بحالة إجازة أو قيمة مناسبة أخرى`);
        }
        // تحديث السجل الموجود
        existing.set({
          checkIn: this.checkIn || existing.checkIn,
          checkOut: this.checkOut || existing.checkOut,
          absence: this.absence !== undefined ? this.absence : existing.absence,
          annualLeave: this.annualLeave !== undefined ? this.annualLeave : existing.annualLeave,
          medicalLeave: this.medicalLeave !== undefined ? this.medicalLeave : existing.medicalLeave,
          officialLeave: this.officialLeave !== undefined ? this.officialLeave : existing.officialLeave,
          leaveCompensation: this.leaveCompensation !== undefined ? this.leaveCompensation : existing.leaveCompensation,
          appropriateValue: this.appropriateValue !== undefined ? this.appropriateValue : existing.appropriateValue,
        });
        await existing.save();
        await this.constructor.deleteOne({ _id: this._id });
        throw new Error(`Merged duplicate record for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}`);
      }
    }

    // تحديث بيانات الموظف
    if (this.isNew || this.isModified('code')) {
      const user = await User.findOne({ code: this.code });
      if (!user) {
        throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
      }
      this.employeeName = user.fullName || 'غير معروف';
      this.workDaysPerWeek = user.workDaysPerWeek || 6;
      this.customAnnualLeave = user.customAnnualLeave || 0;
      this.annualLeaveBalance = user.annualLeaveBalance || 21;
      this.advances = user.advances || 0;
      console.log(
        `Updated employee details for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ` +
          `employeeName=${this.employeeName}, workDaysPerWeek=${this.workDaysPerWeek}, ` +
          `customAnnualLeave=${this.customAnnualLeave}, annualLeaveBalance=${this.annualLeaveBalance}, advances=${this.advances}`
      );
    }

    // التحقق من الحالات المتعددة
    if (
      [this.absence, this.annualLeave, this.medicalLeave, this.officialLeave, this.leaveCompensation > 0, this.appropriateValue > 0].filter(Boolean).length > 1
    ) {
      throw new Error(`لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة، قيمة مناسبة) لـ ${this.code}`);
    }

    // التحقق من رصيد الإجازة السنوية
    if (this.isModified('annualLeave') && this.annualLeave) {
      const user = await User.findOne({ code: this.code });
      if (!user) {
        throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
      }
      if (user.annualLeaveBalance <= 0) {
        throw new Error(`رصيد الإجازة السنوية غير كافٍ لـ ${this.code}`);
      }
      console.log(`Annual leave requested for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: annualLeaveBalance=${user.annualLeaveBalance}`);
    }

    // تسجيل التغييرات في الحالات
    const logChanges = (field, value) => {
      if (this.isModified(field)) {
        console.log(`${field} changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${value}`);
      }
    };
    logChanges('absence', this.absence);
    logChanges('annualLeave', this.annualLeave);
    logChanges('medicalLeave', this.medicalLeave);
    logChanges('officialLeave', this.officialLeave);
    logChanges('leaveCompensation', this.leaveCompensation);
    logChanges('appropriateValue', this.appropriateValue);
    logChanges('earlyLeaveDeduction', this.earlyLeaveDeduction);

    next();
  } catch (err) {
    console.error(`Error in pre-save middleware for ${this.code}:`, err.message, err.stack);
    next(err);
  }
});

// قبل الحذف
fingerprintSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    if (this.annualLeave) {
      const user = await User.findOne({ code: this.code });
      if (user) {
        user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
        await user.save();
        console.log(`Restored 1 day to annualLeaveBalance for ${this.code} on deletion. New balance: ${user.annualLeaveBalance}`);
      }
    }
    next();
  } catch (err) {
    console.error(`Error in pre-deleteOne middleware for ${this.code}:`, err.message, err.stack);
    next(err);
  }
});

// الاحتفاظ بقيمة annualLeave السابقة
fingerprintSchema.pre('save', async function (next) {
  if (!this.isNew && this.isModified('annualLeave')) {
    const prevDoc = await this.constructor.findOne({ _id: this._id });
    this._previousAnnualLeave = prevDoc ? prevDoc.annualLeave : false;
  }
  next();
});

// حساب الحضور
fingerprintSchema.methods.calculateAttendance = async function () {
  try {
    console.log(`Calculating attendance for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}`);
    const recordDate = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' });
    const now = DateTime.now().setZone('Africa/Cairo');
    if (!recordDate.isValid || recordDate > now) {
      throw new Error(`تاريخ غير صالح أو في المستقبل لـ ${this.code}: ${recordDate.toISODate() || 'null'}`);
    }

    const user = await User.findOne({ code: this.code });
    if (!user) {
      throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
    }

    // تحديث بيانات الموظف
    this.employeeName = user.fullName || 'غير معروف';
    this.workDaysPerWeek = user.workDaysPerWeek || 6;
    this.customAnnualLeave = user.customAnnualLeave || 0;
    this.advances = user.advances || 0;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;

    // القيمة المناسبة
    if (this.appropriateValue > 0) {
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
      this.isSingleFingerprint = false;
      this.appropriateValueDays = 1;
      console.log(
        `Appropriate value applied for ${this.code}: appropriateValue=${this.appropriateValue}, ` +
          `appropriateValueDays=${this.appropriateValueDays}, annualLeaveBalance=${this.annualLeaveBalance}`
      );
      await this.save();
      return;
    }

    // بدل الإجازة
    if (this.leaveCompensation > 0) {
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
      this.isSingleFingerprint = false;
      this.appropriateValueDays = 0;
      console.log(`Leave compensation applied for ${this.code}: leaveCompensation=${this.leaveCompensation}, annualLeaveBalance=${this.annualLeaveBalance}`);
      await this.save();
      return;
    }

    // الإجازة الرسمية
    if (this.officialLeave) {
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
      console.log(
        `Official leave applied for ${this.code}: totalOfficialLeaveDays=${user.totalOfficialLeaveDays}, annualLeaveBalance=${this.annualLeaveBalance}`
      );
      await this.save();
      return;
    }

    // الإجازة الطبية
    if (this.medicalLeave) {
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
      console.log(
        `Medical leave applied for ${this.code}: medicalLeaveDeduction=${this.medicalLeaveDeduction}, annualLeaveBalance=${this.annualLeaveBalance}`
      );
      await this.save();
      return;
    }

    // الإجازة السنوية
    if (this.annualLeave) {
      if (user.annualLeaveBalance <= 0) {
        throw new Error(`رصيد الإجازة السنوية غير كافٍ لـ ${this.code}`);
      }
      this.workHours = user.workHoursPerDay || 8;
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

      if (this.isNew || (this.isModified('annualLeave') && this.annualLeave)) {
        user.annualLeaveBalance = Math.max((user.annualLeaveBalance || 21) - 1, 0);
        await user.save();
        console.log(
          `Annual leave applied for ${this.code}: workHours=${this.workHours}, checkIn=${this.checkIn}, ` +
            `checkOut=${this.checkOut}, annualLeaveBalance=${user.annualLeaveBalance}`
        );
      }
      this.annualLeaveBalance = user.annualLeaveBalance || 21;
      await this.save();
      return;
    }

    // إعادة رصيد الإجازة السنوية إذا تم إلغاء الإجازة
    if (this.isModified('annualLeave') && !this.annualLeave && this._previousAnnualLeave === true) {
      user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
      await user.save();
      console.log(
        `Restored 1 day to annualLeaveBalance for ${this.code} due to annualLeave changed to false. New balance: ${user.annualLeaveBalance}`
      );
      this.annualLeaveBalance = user.annualLeaveBalance || 21;
    }

    // الأيام الأسبوعية
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

    // الغياب
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
      console.log(`Absence recorded for ${this.code}: earlyLeaveDeduction=1, annualLeaveBalance=${this.annualLeaveBalance}`);
      await this.save();
      return;
    }

    // بصمة واحدة
    this.isSingleFingerprint = !(this.checkIn && this.checkOut);
    if (this.isSingleFingerprint) {
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
      console.log(`Single fingerprint recorded for ${this.code}: workHours=${this.workHours}, annualLeaveBalance=${this.annualLeaveBalance}`);
      await this.save();
      return;
    }

    // حساب ساعات العمل
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
        console.warn(`Invalid checkIn or checkOut time for ${this.code}: annualLeaveBalance=${this.annualLeaveBalance}`);
        await this.save();
        return;
      }

      const diffMs = checkOut.toMillis() - checkIn.toMillis();
      const hours = diffMs / (1000 * 60 * 60);
      this.workHours = Math.max(hours, 0).toFixed(2); // تسجيل إجمالي الساعات بدون حد أقصى
      this.overtime = hours > (user.workHoursPerDay || 8) ? (hours - (user.workHoursPerDay || 8)).toFixed(2) : 0; // حساب الساعات الإضافية
      // فحص إضافي للتأكد من أن الساعات ليست غير معقولة (أكثر من 24 ساعة)
      if (hours > 24) {
        console.warn(`Unreasonable work hours (${hours}) for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}, resetting to 0`);
        this.workHours = 0;
        this.overtime = 0;
      }
      this.medicalLeaveDeduction = 0;
      this.absence = false;
      this.annualLeave = false;
      this.medicalLeave = false;
      this.officialLeave = false;
      this.leaveCompensation = 0;
      this.appropriateValueDays = 0;
      console.log(`Attendance calculated for ${this.code}: workHours=${this.workHours}, overtime=${this.overtime}, annualLeaveBalance=${this.annualLeaveBalance}`);
      await this.save();
    }
  } catch (err) {
    console.error(`Error in calculateAttendance for ${this.code}:`, err.message, err.stack);
    throw err;
  }
};

// دالة مساعدة لإنشاء سجل افتراضي ليوم مفقود
fingerprintSchema.statics.createMissingReport = async function (code, date) {
  const user = await User.findOne({ code });
  if (!user) {
    throw new Error(`لا يوجد مستخدم بكود ${code}`);
  }
  const workDaysPerWeek = user.workDaysPerWeek || 6;
  const isWeekly = isWeeklyLeaveDay(date, workDaysPerWeek);

  const fingerprint = new this({
    code,
    date,
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
};

const Fingerprint = mongoose.models.Fingerprint || mongoose.model('Fingerprint', fingerprintSchema);

export default Fingerprint;
