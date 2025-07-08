import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { DateTime } from 'luxon';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, TextRun, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { SettingsIcon } from 'lucide-react';

// مكون علامة الصح
const SuccessCheckmark = ({ onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.5 } }}
      exit={{ opacity: 0, scale: 0.5 }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          transition: { duration: 1.5, repeat: Infinity, repeatType: 'loop' },
        }}
        className="bg-gradient-to-br from-teal-500 to-emerald-400 p-8 rounded-2xl shadow-2xl w-32 h-32 flex items-center justify-center"
      >
        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, transition: { duration: 0.8 } }}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
};

// مكون مؤشر التحميل
const LoadingSpinner = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm"
  >
    <div className="relative">
      <motion.div
        className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-teal-100 text-sm font-medium font-amiri">
        جارٍ التحميل...
      </span>
    </div>
  </motion.div>
);

const MonthlyBonusReport = () => {
  const { user: currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchCode, setSearchCode] = useState(currentUser?.role !== 'admin' ? currentUser?.code || '' : '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (currentUser.role !== 'admin') {
      setSearchCode(currentUser.code || '');
    }
  }, [currentUser, navigate]);

  const triggerSuccessAnimation = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const calculateNetBonus = (user, absences, tieUpValue, productionValue, advances, deductions) => {
    const baseBonus = Number(user.baseBonus || 0);
    const bonusPercentage = Number(user.bonusPercentage || 0);
    const bonus = baseBonus * (1 + bonusPercentage / 100);
    const dailyBonus = bonus / 30;
    const absenceDeduction = Number(absences || 0) * dailyBonus;
    const adjustedBonus = bonus - absenceDeduction;
    const netBonus = adjustedBonus + Number(tieUpValue || 0) + Number(productionValue || 0) - Number(advances || 0) - Number(deductions || 0);
    return Math.max(0, netBonus).toFixed(2);
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) {
      setError('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('day');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('day');

    if (!startDate.isValid || !endDate.isValid) {
      setError('تاريخ البداية أو النهاية غير صالح');
      return;
    }

    if (startDate > endDate) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const endpoint = currentUser.role === 'admin' ? '/api/bonus-reports' : '/api/bonus-reports/me';
      const response = await axios.get(`${process.env.REACT_APP_API_URL}${endpoint}`, {
        params: {
          dateFrom: startDate.toISODate(),
          dateTo: endDate.toISODate(),
          ...(currentUser.role === 'admin' && searchCode && { code: searchCode }),
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const reportData = currentUser.role === 'admin' ? 
        (Array.isArray(response.data.reports) ? response.data.reports : [response.data]) :
        [response.data.report];

      setUsers(reportData.map((report) => ({
        ...report,
        employeeName: report.employeeName || 'غير معروف',
        department: report.department || '',
        baseBonus: Number(report.baseBonus || 0),
        bonusPercentage: Number(report.bonusPercentage || 0),
        workDaysPerWeek: Number(report.workDaysPerWeek || 6),
        totalWorkDays: Number(report.totalWorkDays || 0),
        absences: Number(report.absences || 0),
        annualLeave: Number(report.annualLeave || 0),
        totalLeaveDays: Number(report.totalLeaveDays || 0),
        tieUpValue: Number(report.tieUpValue || 0),
        productionValue: Number(report.productionValue || 0),
        advances: Number(report.advances || 0),
        deductions: Number(report.deductions || 0),
        netBonus: Number(report.netBonus || 0),
        dateFrom: DateTime.fromJSDate(new Date(report.dateFrom)).toISODate(),
        dateTo: DateTime.fromJSDate(new Date(report.dateTo)).toISODate(),
      })));
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message;
      setError(`خطأ أثناء جلب البيانات: ${errorMsg}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = async () => {
    if (!dateFrom || !dateTo) {
      setError('يرجى تحديد تاريخ البداية والنهاية');
      return;
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('day');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('day');

    if (!startDate.isValid || !endDate.isValid) {
      setError('تاريخ البداية أو النهاية غير صالح');
      return;
    }

    if (startDate > endDate) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    if (currentUser.role !== 'admin') {
      setError('عرض جميع التقارير متاح فقط للإداريين');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/bonus-reports`, {
        params: {
          dateFrom: startDate.toISODate(),
          dateTo: endDate.toISODate(),
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const reportData = Array.isArray(response.data.reports) ? response.data.reports : [response.data];

      setUsers(reportData.map((report) => ({
        ...report,
        employeeName: report.employeeName || 'غير معروف',
        department: report.department || '',
        baseBonus: Number(report.baseBonus || 0),
        bonusPercentage: Number(report.bonusPercentage || 0),
        workDaysPerWeek: Number(report.workDaysPerWeek || 6),
        totalWorkDays: Number(report.totalWorkDays || 0),
        absences: Number(report.absences || 0),
        annualLeave: Number(report.annualLeave || 0),
        totalLeaveDays: Number(report.totalLeaveDays || 0),
        tieUpValue: Number(report.tieUpValue || 0),
        productionValue: Number(report.productionValue || 0),
        advances: Number(report.advances || 0),
        deductions: Number(report.deductions || 0),
        netBonus: Number(report.netBonus || 0),
        dateFrom: DateTime.fromJSDate(new Date(report.dateFrom)).toISODate(),
        dateTo: DateTime.fromJSDate(new Date(report.dateTo)).toISODate(),
      })));
      setSearchCode('');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message;
      setError(`خطأ أثناء جلب جميع البيانات: ${errorMsg}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (userData) => {
    if (currentUser.role !== 'admin') {
      setError('التعديل متاح فقط للإداريين');
      return;
    }
    setEditingUser(userData);
    setEditForm({
      code: userData.code,
      tieUpValue: Number(userData.tieUpValue || 0).toFixed(2),
      productionValue: Number(userData.productionValue || 0).toFixed(2),
      advances: Number(userData.advances || 0).toFixed(2),
      deductions: Number(userData.deductions || 0).toFixed(2),
      netBonus: Number(userData.netBonus || 0).toFixed(2),
    });
    setError('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => {
      const updatedForm = { ...prev, [name]: value };
      const netBonus = calculateNetBonus(
        editingUser,
        editingUser.absences,
        Number(updatedForm.tieUpValue) || 0,
        Number(updatedForm.productionValue) || 0,
        Number(updatedForm.advances) || 0,
        Number(updatedForm.deductions) || 0
      );
      return { ...updatedForm, netBonus };
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') {
      setError('التعديل متاح فقط للإداريين');
      return;
    }

    if (!dateFrom || !dateTo) {
      setError('تاريخ البداية والنهاية مطلوبان');
      return;
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('day');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('day');

    if (!startDate.isValid || !endDate.isValid) {
      setError('تاريخ البداية أو النهاية غير صالح');
      return;
    }

    if (startDate > endDate) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { tieUpValue, productionValue, advances, deductions } = editForm;

      if (Number(tieUpValue) < 0) {
        setError('قيمة التربيط لا يمكن أن تكون سالبة');
        return;
      }
      if (Number(productionValue) < 0) {
        setError('قيمة الإنتاج لا يمكن أن تكون سالبة');
        return;
      }
      if (Number(advances) < 0) {
        setError('السلف لا يمكن أن تكون سالبة');
        return;
      }
      if (Number(deductions) < 0) {
        setError('الاستقطاعات لا يمكن أن تكون سالبة');
        return;
      }

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/bonus-reports/${editForm.code}`,
        {
          code: editForm.code,
          tieUpValue: Number(tieUpValue),
          productionValue: Number(productionValue),
          advances: Number(advances),
          deductions: Number(deductions),
          dateFrom: startDate.toISODate(),
          dateTo: endDate.toISODate(),
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      setUsers((prev) =>
        prev.map((u) =>
          u.code === editForm.code &&
          u.dateFrom === startDate.toISODate() &&
          u.dateTo === endDate.toISODate()
            ? {
                ...u,
                tieUpValue: Number(response.data.report.tieUpValue || u.tieUpValue),
                productionValue: Number(response.data.report.productionValue || u.productionValue),
                advances: Number(response.data.report.advances || u.advances),
                deductions: Number(response.data.report.deductions || u.deductions),
                netBonus: Number(response.data.report.netBonus || u.netBonus),
              }
            : u
        )
      );

      setEditingUser(null);
      setEditForm({});
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message;
      setError(`خطأ أثناء التعديل: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditForm({});
    setError('');
  };

  const handleSaveReport = async () => {
    if (currentUser.role !== 'admin') {
      setError('حفظ التقرير متاح فقط للإداريين');
      return;
    }

    if (!dateFrom || !dateTo) {
      setError('تاريخ البداية والنهاية مطلوبان');
      return;
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('day');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('day');

    if (!startDate.isValid || !endDate.isValid) {
      setError('تاريخ البداية أو النهاية غير صالح');
      return;
    }

    if (startDate > endDate) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await Promise.all(
        users.map((user) =>
          axios.post(
            `${process.env.REACT_APP_API_URL}/api/bonus-reports`,
            {
              code: user.code,
              tieUpValue: Number(user.tieUpValue),
              productionValue: Number(user.productionValue),
              advances: Number(user.advances),
              deductions: Number(user.deductions),
              dateFrom: startDate.toISODate(),
              dateTo: endDate.toISODate(),
            },
            {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            }
          )
        )
      );
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message;
      setError(`خطأ أثناء حفظ التقرير: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      ...(currentUser.role === 'admin' ? ['كود الموظف', 'الاسم', 'القسم'] : []),
      'الحافز الأساسي',
      'نسبة الحافز',
      'أيام العمل الأسبوعية',
      'إجمالي أيام العمل',
      'الغياب',
      'الإجازة السنوية',
      'إجمالي الإجازات',
      'قيمة التربيط',
      'قيمة الإنتاج',
      'السلف',
      'الاستقطاعات',
      'صافي الحافز',
    ];

    const data = users.map((user) => [
      ...(currentUser.role === 'admin' ? [user.code, user.employeeName, user.department] : []),
      Number(user.baseBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      `${Number(user.bonusPercentage || 0).toFixed(2)}%`,
      user.workDaysPerWeek,
      user.totalWorkDays,
      user.absences,
      user.annualLeave,
      user.totalLeaveDays,
      Number(user.tieUpValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      Number(user.productionValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      Number(user.advances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      Number(user.deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      Number(user.netBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    ]);

    const titleRow = ['تقرير الحافز الشهري'];
    const dateRow = [`التاريخ: من ${DateTime.fromISO(dateFrom).toLocaleString(DateTime.DATE_FULL, { locale: 'ar' })} إلى ${DateTime.fromISO(dateTo).toLocaleString(DateTime.DATE_FULL, { locale: 'ar' })}`];

    const sheetData = [
      titleRow,
      dateRow,
      [],
      headers,
      ...data,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    worksheet['!rtl'] = false; // تعيين الاتجاه من اليسار إلى اليمين
    worksheet['!freeze'] = { xSplit: 0, ySplit: 3 };

    const colWidths = headers.map((header, i) => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => String(row[i] || '').length)
      );
      return { wch: Math.max(10, maxLength + 2) };
    });
    worksheet['!cols'] = colWidths;

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) continue;

        if (row === 0) {
          worksheet[cellAddress].s = {
            font: { name: 'Amiri', sz: 16, bold: true },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: '1E3A8A' } },
            color: { rgb: 'FFFFFF' },
          };
        } else if (row === 1) {
          worksheet[cellAddress].s = {
            font: { name: 'Amiri', sz: 12 },
            alignment: { horizontal: 'left', vertical: 'center' },
          };
        } else if (row === 3) {
          worksheet[cellAddress].s = {
            font: { name: 'Amiri', sz: 12, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: '1E3A8A' } },
            color: { rgb: 'FFFFFF' },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        } else if (row >= 4) {
          worksheet[cellAddress].s = {
            font: { name: 'Amiri', sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
            fill: { fgColor: { rgb: row % 2 === 0 ? 'F3F4F6' : 'FFFFFF' } },
          };
          if ([currentUser.role === 'admin' ? 0 : 3, 1, 2, 3, 4, 11].includes(col)) {
            worksheet[cellAddress].z = '#,##0.00';
          }
        }
      }
    }

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'تقرير الحافز الشهري');
    XLSX.writeFile(wb, `تقرير_الحافز_الشهري_${dateFrom}_إلى_${dateTo}.xlsx`);
  };

  const handleExportWord = async () => {
    const doc = new Document({
      sections: [
        {
          properties: { page: { margin: { left: 720, right: 720, top: 720, bottom: 720 } } },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'تقرير الحافز الشهري',
                  bold: true,
                  size: 24,
                  font: 'Amiri',
                  rightToLeft: false,
                  color: '1E3A8A',
                }),
              ],
              alignment: 'left',
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `التاريخ: من ${DateTime.fromISO(dateFrom).toLocaleString(DateTime.DATE_FULL, { locale: 'ar' })} إلى ${DateTime.fromISO(dateTo).toLocaleString(DateTime.DATE_FULL, { locale: 'ar' })}`,
                  size: 20,
                  font: 'Amiri',
                  rightToLeft: false,
                }),
              ],
              alignment: 'left',
              spacing: { after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    ...(currentUser.role === 'admin' ? ['كود الموظف', 'الاسم', 'القسم'] : []),
                    'الحافز الأساسي',
                    'نسبة الحافز',
                    'أيام العمل الأسبوعية',
                    'إجمالي أيام العمل',
                    'الغياب',
                    'الإجازة السنوية',
                    'إجمالي الإجازات',
                    'قيمة التربيط',
                    'قيمة الإنتاج',
                    'السلف',
                    'الاستقطاعات',
                    'صافي الحافز',
                  ].map(
                    (header) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: header, bold: true, font: 'Amiri', size: 20, rightToLeft: false, color: 'FFFFFF' })],
                            alignment: 'center',
                          }),
                        ],
                        width: { size: 100 / (currentUser.role === 'admin' ? 15 : 12), type: WidthType.PERCENTAGE },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        shading: { fill: '1E3A8A', type: ShadingType.SOLID },
                      })
                  ),
                }),
                ...users.map(
                  (user, index) =>
                    new TableRow({
                      children: [
                        ...(currentUser.role === 'admin' ? [
                          user.code,
                          user.employeeName,
                          user.department,
                        ] : []),
                        Number(user.baseBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        `${Number(user.bonusPercentage || 0).toFixed(2)}%`,
                        user.workDaysPerWeek.toString(),
                        user.totalWorkDays.toString(),
                        user.absences.toString(),
                        user.annualLeave.toString(),
                        user.totalLeaveDays.toString(),
                        Number(user.tieUpValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        Number(user.productionValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        Number(user.advances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        Number(user.deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        Number(user.netBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                      ].map(
                        (text) =>
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [new TextRun({ text, font: 'Amiri', size: 20, rightToLeft: false })],
                                alignment: 'center',
                              }),
                            ],
                            width: { size: 100 / (currentUser.role === 'admin' ? 15 : 12), type: WidthType.PERCENTAGE },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            shading: { fill: index % 2 === 0 ? 'F3F4F6' : 'FFFFFF', type: ShadingType.SOLID },
                          })
                      ),
                    })
                ),
                new TableRow({
                  children: [
                    ...(currentUser.role === 'admin' ? ['-', 'الإجمالي', '-'] : []),
                    '-',
                    '-',
                    users.reduce((sum, user) => sum + Number(user.workDaysPerWeek || 0), 0).toString(),
                    users.reduce((sum, user) => sum + Number(user.totalWorkDays || 0), 0).toString(),
                    users.reduce((sum, user) => sum + Number(user.absences || 0), 0).toString(),
                    users.reduce((sum, user) => sum + Number(user.annualLeave || 0), 0).toString(),
                    users.reduce((sum, user) => sum + Number(user.totalLeaveDays || 0), 0).toString(),
                    users.reduce((sum, user) => sum + Number(user.tieUpValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    users.reduce((sum, user) => sum + Number(user.productionValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    users.reduce((sum, user) => sum + Number(user.advances || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    users.reduce((sum, user) => sum + Number(user.deductions || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    users.reduce((sum, user) => sum + Number(user.netBonus || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                  ].map(
                    (text) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text, font: 'Amiri', size: 20, rightToLeft: false, bold: true, color: '000000' })],
                            alignment: 'center',
                          }),
                        ],
                        width: { size: 100 / (currentUser.role === 'admin' ? 15 : 12), type: WidthType.PERCENTAGE },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        shading: { fill: 'BFDBFE', type: ShadingType.SOLID },
                      })
                  ),
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `تقرير_الحافز_الشهري_${dateFrom}_إلى_${dateTo}.docx`);
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-amiri">
      <NavBar />
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <AnimatePresence>
          {loading && <LoadingSpinner />}
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100 mb-6"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-right flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-blue-600" />
            تقرير الحافز الشهري
          </h2>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
            >
              {error}
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={searchCode}
                onChange={(e) => currentUser.role === 'admin' ? setSearchCode(e.target.value) : null}
                className={`w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 ${
                  currentUser.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                placeholder="أدخل كود الموظف"
                disabled={loading || currentUser.role !== 'admin'}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                من تاريخ
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <motion.button
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جارٍ البحث...' : 'بحث'}
            </motion.button>
            {currentUser.role === 'admin' && (
              <motion.button
                onClick={handleShowAll}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-gray-600 text-white px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-all duration-200 text-sm font-medium shadow-md ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'جارٍ الجلب...' : 'عرض الكل'}
              </motion.button>
            )}
            {currentUser.role === 'admin' && (
              <motion.button
                onClick={handleExportExcel}
                disabled={loading || users.length === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium shadow-md ${
                  loading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                تصدير إكسل
              </motion.button>
            )}
            {currentUser.role === 'admin' && (
              <motion.button
                onClick={handleExportWord}
                disabled={loading || users.length === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-all duration-200 text-sm font-medium shadow-md ${
                  loading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                تصدير وورد
              </motion.button>
            )}
            {currentUser.role === 'admin' && (
              <motion.button
                onClick={handleSaveReport}
                disabled={loading || users.length === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 transition-all duration-200 text-sm font-medium shadow-md ${
                  loading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'جارٍ الحفظ...' : 'حفظ التقرير'}
              </motion.button>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {editingUser && currentUser.role === 'admin' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            >
              <motion.div
                className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-gray-800 mb-6 text-right flex items-center gap-3">
                  <SettingsIcon className="h-6 w-6 text-blue-600" />
                  تعديل بيانات التقرير
                </h2>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
                  >
                    {error}
                  </motion.div>
                )}
                <div className="space-y-5">
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={editForm.code}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm bg-gray-100 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      قيمة التربيط
                    </label>
                    <input
                      type="number"
                      name="tieUpValue"
                      value={editForm.tieUpValue}
                      onChange={handleEditChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                      min="0"
                      step="0.01"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      قيمة الإنتاج
                    </label>
                    <input
                      type="number"
                      name="productionValue"
                      value={editForm.productionValue}
                      onChange={handleEditChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                      min="0"
                      step="0.01"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      السلف
                    </label>
                    <input
                      type="number"
                      name="advances"
                      value={editForm.advances}
                      onChange={handleEditChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                      min="0"
                      step="0.01"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      الاستقطاعات
                    </label>
                    <input
                      type="number"
                      name="deductions"
                      value={editForm.deductions}
                      onChange={handleEditChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                      min="0"
                      step="0.01"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      صافي الحافز
                    </label>
                    <input
                      type="text"
                      value={Number(editForm.netBonus).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm bg-gray-100 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <motion.button
                      onClick={handleEditSubmit}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الحفظ...' : 'حفظ'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleEditCancel}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-gray-600 text-white px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-all duration-200 text-sm font-medium shadow-md ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        </AnimatePresence>

        {users.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-6 text-right">
              تقرير الحافز الشهري
            </h2>
            <div className="overflow-x-auto max-h-[60vh] rounded-lg shadow-sm">
              <table className="w-full text-right text-sm border-collapse" dir="rtl">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-700 to-blue-500 text-white sticky top-0 z-10">
                    {[
                      ...(currentUser.role === 'admin' ? ['كود الموظف', 'الاسم', 'القسم'] : []),
                      'الحافز الأساسي',
                      'نسبة الحافز',
                      'أيام العمل الأسبوعية',
                      'إجمالي أيام العمل',
                      'الغياب',
                      'الإجازة السنوية',
                      'إجمالي الإجازات',
                      'قيمة التربيط',
                      'قيمة الإنتاج',
                      'السلف',
                      'الاستقطاعات',
                      'صافي الحافز',
                      ...(currentUser.role === 'admin' ? ['إجراءات'] : []),
                    ].map((header) => (
                      <th
                        key={header}
                        className="p-4 font-semibold text-sm border-b border-gray-200 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr
                      key={index}
                      className={`${
                        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-blue-50 transition-all duration-200 border-b border-gray-100`}
                    >
                      {currentUser.role === 'admin' && (
                        <>
                          <td className="p-4 text-gray-700 whitespace-nowrap">{user.code}</td>
                          <td className="p-4 text-gray-700">{user.employeeName}</td>
                          <td className="p-4 text-gray-700">{user.department}</td>
                        </>
                      )}
                      <td className="p-4 text-gray-700">
                        {Number(user.baseBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-gray-700">{Number(user.bonusPercentage || 0).toFixed(2)}%</td>
                      <td className="p-4 text-gray-700 text-center">{user.workDaysPerWeek}</td>
                      <td className="p-4 text-gray-700 text-center">{user.totalWorkDays}</td>
                      <td className="p-4 text-gray-700 text-center">{user.absences}</td>
                      <td className="p-4 text-gray-700 text-center">{user.annualLeave}</td>
                      <td className="p-4 text-gray-700 text-center">{user.totalLeaveDays}</td>
                      <td className="p-4 text-gray-700">
                        {Number(user.tieUpValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-gray-700">
                        {Number(user.productionValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-gray-700">
                        {Number(user.advances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-gray-700">
                        {Number(user.deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-gray-800 font-semibold">
                        {Number(user.netBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      {currentUser.role === 'admin' && (
                        <td className="p-4">
                          <motion.button
                            onClick={() => handleEditClick(user)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md"
                          >
                            تعديل
                          </motion.button>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-blue-100 font-semibold sticky bottom-0">
                    {currentUser.role === 'admin' && (
                      <>
                        <td className="p-4">-</td>
                        <td className="p-4">الإجمالي</td>
                        <td className="p-4">-</td>
                      </>
                    )}
                    <td className="p-4">-</td>
                    <td className="p-4">-</td>
                    <td className="p-4 text-center">
                      {users.reduce((sum, user) => sum + Number(user.workDaysPerWeek || 0), 0)}
                    </td>
                    <td className="p-4 text-center">
                      {users.reduce((sum, user) => sum + Number(user.totalWorkDays || 0), 0)}
                    </td>
                    <td className="p-4 text-center">
                      {users.reduce((sum, user) => sum + Number(user.absences || 0), 0)}
                    </td>
                    <td className="p-4 text-center">
                      {users.reduce((sum, user) => sum + Number(user.annualLeave || 0), 0)}
                    </td>
                    <td className="p-4 text-center">
                      {users.reduce((sum, user) => sum + Number(user.totalLeaveDays || 0), 0)}
                    </td>
                    <td className="p-4">
                      {users.reduce((sum, user) => sum + Number(user.tieUpValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {users.reduce((sum, user) => sum + Number(user.productionValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {users.reduce((sum, user) => sum + Number(user.advances || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {users.reduce((sum, user) => sum + Number(user.deductions || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {users.reduce((sum, user) => sum + Number(user.netBonus || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    {currentUser.role === 'admin' && <td className="p-4">-</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            {currentUser.role === 'admin' && (
              <motion.button
                onClick={handleSaveReport}
                disabled={loading || users.length === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full mt-6 bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 transition-all duration-200 text-sm font-medium shadow-md ${
                  loading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'جارٍ الحفظ...' : 'حفظ التقرير'}
              </motion.button>
            )}
          </motion.div>
        ) : (
          !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100 text-center"
            >
              <p className="text-gray-600 text-sm">
                {currentUser.role === 'admin'
                  ? 'لا توجد تقارير حوافز متاحة لهذه الفترة أو كود الموظف. يرجى التحقق من البيانات المدخلة.'
                  : 'لا توجد بيانات لتقرير حافزك في الفترة المحددة. يرجى تحديد الفترة الزمنية والضغط على "بحث".'}
              </p>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
};

export default MonthlyBonusReport;
