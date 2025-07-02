import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String },
});

export default mongoose.model('Holiday', holidaySchema);
