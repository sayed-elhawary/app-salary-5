import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  department: String,
  baseBonus: Number,
  bonusPercentage: Number,
  workDaysPerWeek: { type: Number, default: 6 },
});

export default mongoose.model('Employee', employeeSchema);
