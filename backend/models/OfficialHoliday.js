// models/OfficialHoliday.js
import mongoose from 'mongoose';

const officialHolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String },
});

export default mongoose.model('OfficialHoliday', officialHolidaySchema);
