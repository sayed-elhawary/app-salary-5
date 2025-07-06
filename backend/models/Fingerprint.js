import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import User from './User.js';

const fingerprintSchema = new mongoose.Schema({
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
  },
  overtime: {
    type: Number,
    default: 0,
  },
  lateMinutes: {
    type: Number,
    default: 0,
  },
  lateDeduction: {
    type: Number,
    default: 0,
  },
  earlyLeaveDeduction: {
    type: Number,
    default: 0,
  },
  medicalLeave: {
    type: Boolean,
    default: false,
  },
  medicalLeaveDeduction: {
    type: Number,
    default: 0,
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
  },
  annualLeaveBalance: {
    type: Number,
    default: 21,
  },
  advances: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

fingerprintSchema.index({ code: 1, date: 1 }, { unique: true });
fingerprintSchema.index({ date: -1, code: 1 });

const isWeeklyLeaveDay = (date, workDaysPerWeek) => {
  const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
  return (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
         (workDaysPerWeek === 6 && dayOfWeek === 5);
};

fingerprintSchema.pre('save', async function (next) {
  try {
    if (this.isNew || this.isModified('code') || this.isModified('date')) {
      const existing = await this.constructor.findOne({
        code: this.code,
        date: {
          $gte: DateTime.fromJSDate(this.date).startOf('day').toJSDate(),
          $lte: DateTime.fromJSDate(this.date).endOf('day').toJSDate(),
        },
      });
      if (existing && (existing.annualLeave || existing.medicalLeave || existing.officialLeave || existing.leaveCompensation > 0) && (this.annualLeave || this.medicalLeave || this.officialLeave || this.leaveCompensation > 0)) {
        throw new Error(`يوم ${DateTime.fromJSDate(this.date).toISODate()} لـ ${this.code} مسجل مسبقًا بحالة إجازة أخرى`);
      }
    }

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
      console.log(`Updated employee details for fingerprint ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: employeeName=${this.employeeName}, workDaysPerWeek=${this.workDaysPerWeek}, customAnnualLeave=${this.customAnnualLeave}, annualLeaveBalance=${this.annualLeaveBalance}, advances=${this.advances}`);
    }

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

    if (this.isModified('absence')) {
      console.log(`Absence changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${this.absence}`);
    }
    if (this.isModified('annualLeave')) {
      console.log(`Annual leave changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${this.annualLeave}`);
    }
    if (this.isModified('medicalLeave')) {
      console.log(`Medical leave changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${this.medicalLeave}`);
    }
    if (this.isModified('officialLeave')) {
      console.log(`Official leave changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${this.officialLeave}`);
    }
    if (this.isModified('leaveCompensation')) {
      console.log(`Leave compensation changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${this.leaveCompensation}`);
    }
    if (this.isModified('earlyLeaveDeduction')) {
      console.log(`Early leave deduction changed for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}: ${this.earlyLeaveDeduction}`);
    }
    next();
  } catch (err) {
    console.error(`Error in pre-save middleware for ${this.code}:`, err.message);
    next(err);
  }
});

fingerprintSchema.pre('remove', async function (next) {
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
    console.error(`Error in pre-remove middleware for ${this.code}:`, err.message);
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
  console.log(`Calculating attendance for ${this.code} on ${DateTime.fromJSDate(this.date).toISODate()}`);
  const now = DateTime.now().setZone('Africa/Cairo');
  const recordDate = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' });
  if (!recordDate.isValid || recordDate > now) {
    throw new Error(`تاريخ غير صالح أو في المستقبل لـ ${this.code}: ${recordDate.toISODate()}`);
  }

  if ([this.absence, this.annualLeave, this.medicalLeave, this.officialLeave, this.leaveCompensation > 0].filter(Boolean).length > 1) {
    throw new Error(`لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة) لـ ${this.code}`);
  }

  const user = await User.findOne({ code: this.code });
  if (!user) {
    throw new Error(`لا يوجد مستخدم بكود ${this.code}`);
  }

  this.employeeName = user.fullName || 'غير معروف';
  this.workDaysPerWeek = user.workDaysPerWeek || 6;
  this.customAnnualLeave = user.customAnnualLeave || 0;
  this.advances = user.advances || 0;

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
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    console.log(`Leave compensation applied for ${this.code}: leaveCompensation=${this.leaveCompensation}, annualLeaveBalance=${this.annualLeaveBalance}`);
    return;
  }

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
    this.isSingleFingerprint = false;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    user.totalOfficialLeaveDays = (user.totalOfficialLeaveDays || 0) + 1;
    await user.save();
    console.log(`Official leave applied for ${this.code}: totalOfficialLeaveDays=${user.totalOfficialLeaveDays}, annualLeaveBalance=${this.annualLeaveBalance}`);
    return;
  }

  if (this.medicalLeave) {
    this.workHours = 0;
    this.overtime = 0;
    this.lateMinutes = 0;
    this.lateDeduction = 0;
    this.earlyLeaveDeduction = 0;
    this.medicalLeaveDeduction = 0.25;
    this.absence = false;
    this.annualLeave = false;
    this.officialLeave = false;
    this.leaveCompensation = 0;
    this.isSingleFingerprint = false;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    console.log(`Medical leave applied for ${this.code}: medicalLeaveDeduction=0.25, annualLeaveBalance=${this.annualLeaveBalance}`);
    return;
  }

  if (this.annualLeave) {
    if (user.annualLeaveBalance <= 0) {
      throw new Error(`رصيد الإجازة السنوية غير كافٍ لـ ${this.code}`);
    }
    this.workHours = 8;
    this.overtime = 0;
    this.lateMinutes = 0;
    this.lateDeduction = 0;
    this.earlyLeaveDeduction = 0;
    this.medicalLeaveDeduction = 0;
    this.absence = false;
    this.medicalLeave = false;
    this.officialLeave = false;
    this.leaveCompensation = 0;
    this.isSingleFingerprint = false;
    this.checkIn = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({ hour: 8, minute: 30 }).toJSDate();
    this.checkOut = DateTime.fromJSDate(this.date, { zone: 'Africa/Cairo' }).set({ hour: 17, minute: 30 }).toJSDate();

    if (this.isNew || (this.isModified('annualLeave') && this.annualLeave)) {
      user.annualLeaveBalance = Math.max((user.annualLeaveBalance || 21) - 1, 0);
      await user.save();
      console.log(`Annual leave applied for ${this.code}: workHours=8, checkIn=${this.checkIn}, checkOut=${this.checkOut}, annualLeaveBalance=${user.annualLeaveBalance}`);
    }
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    return;
  }

  if (this.isModified('annualLeave') && !this.annualLeave && this._previousAnnualLeave === true) {
    user.annualLeaveBalance = (user.annualLeaveBalance || 21) + 1;
    await user.save();
    console.log(`Restored 1 day to annualLeaveBalance for ${this.code} due to annualLeave changed to false. New balance: ${user.annualLeaveBalance}`);
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
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
    this.isSingleFingerprint = false;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    console.log(`Weekly leave day for ${this.code}: no deductions, annualLeaveBalance=${this.annualLeaveBalance}`);
    return;
  }

  if (!this.checkIn && !this.checkOut) {
    this.workHours = 0;
    this.overtime = 0;
    this.lateMinutes = 0;
    this.lateDeduction = 0;
    this.earlyLeaveDeduction = 1;
    this.medicalLeaveDeduction = 0;
    this.isSingleFingerprint = false;
    this.annualLeave = false;
    this.medicalLeave = false;
    this.officialLeave = false;
    this.leaveCompensation = 0;
    this.absence = true;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    console.log(`Absence recorded for ${this.code}: earlyLeaveDeduction=1, annualLeaveBalance=${this.annualLeaveBalance}`);
    return;
  }

  this.isSingleFingerprint = !(this.checkIn && this.checkOut);
  if (this.isSingleFingerprint) {
    this.workHours = 9;
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
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    console.log(`Single fingerprint recorded for ${this.code}: workHours=9, annualLeaveBalance=${this.annualLeaveBalance}`);
    return;
  }

  if (this.checkIn && this.checkOut) {
    const checkIn = DateTime.fromJSDate(this.checkIn, { zone: 'Africa/Cairo' });
    const checkOut = DateTime.fromJSDate(this.checkOut, { zone: 'Africa/Cairo' });
    if (!checkIn.isValid || !checkOut.isValid) {
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
      this.annualLeaveBalance = user.annualLeaveBalance || 21;
      console.warn(`Invalid checkIn or checkOut time for ${this.code}: annualLeaveBalance=${this.annualLeaveBalance}`);
      return;
    }

    const diffMs = checkOut.toMillis() - checkIn.toMillis();
    const hours = diffMs / (1000 * 60 * 60);
    this.workHours = Math.max(hours, 0);
    this.overtime = hours > 8 ? hours - 8 : 0;
    this.medicalLeaveDeduction = 0;
    this.absence = false;
    this.annualLeave = false;
    this.medicalLeave = false;
    this.officialLeave = false;
    this.leaveCompensation = 0;
    this.annualLeaveBalance = user.annualLeaveBalance || 21;
    console.log(`Attendance calculated for ${this.code}: workHours=${this.workHours}, overtime=${this.overtime}, annualLeaveBalance=${this.annualLeaveBalance}`);
  }
};

const Fingerprint = mongoose.models.Fingerprint || mongoose.model('Fingerprint', fingerprintSchema);

export default Fingerprint;
