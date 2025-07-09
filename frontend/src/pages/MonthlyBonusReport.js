import { useContext, useEffect, useState } from 'react';
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
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          transition: { duration: 1.5, repeat: Infinity, repeatType: 'loop' },
        }}
        className="relative w-20 h-20"
      >
        <svg className="w-full h-full text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    className="fixed inset-0 flex items-center justify-center z-50"
  >
    <motion.div
      className="relative flex items-center justify-center"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
    >
      <svg className="w-16 h-16" viewBox="0 0 50 50">
        <motion.circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="4"
          strokeDasharray="80 200"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-medium text-teal-600 font-amiri">
        جارٍ التحميل
      </span>
    </motion.div>
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
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const refreshData = async () => {
    if (!dateFrom || !dateTo) return;
    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');
    if (!startDate.isValid || !endDate.isValid) return;
    if (startDate > endDate) return;

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
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
        },
      });

      const reportData = currentUser.role === 'admin' ? 
        (Array.isArray(response.data.reports) ? response.data.reports : [response.data]) :
        [response.data.report];

      setUsers(reportData.map((report) => ({
        code: report.code || '',
        employeeName: report.employeeName || 'غير معروف',
        department: report.department || '',
        baseBonus: Number(report.baseBonus || 0),
        bonusPercentage: Number(report.bonusPercentage || 0),
        workDaysPerWeek: Number(report.workDaysPerWeek || 6),
        totalWorkDays: Number(report.totalWorkDays || 0),
        absences: Number(report.absences || 0),
        annualLeave: Number(report.annualLeave || 0),
        medicalLeave: Number(report.medicalLeave || 0),
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
      console.error('Error details:', err.response?.data);
      setError(`خطأ أثناء تحديث البيانات: ${errorMsg}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) {
      setError('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');

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
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
        },
      });

      const reportData = currentUser.role === 'admin' ? 
        (Array.isArray(response.data.reports) ? response.data.reports : [response.data]) :
        [response.data.report];

      setUsers(reportData.map((report) => ({
        code: report.code || '',
        employeeName: report.employeeName || 'غير معروف',
        department: report.department || '',
        baseBonus: Number(report.baseBonus || 0),
        bonusPercentage: Number(report.bonusPercentage || 0),
        workDaysPerWeek: Number(report.workDaysPerWeek || 6),
        totalWorkDays: Number(report.totalWorkDays || 0),
        absences: Number(report.absences || 0),
        annualLeave: Number(report.annualLeave || 0),
        medicalLeave: Number(report.medicalLeave || 0),
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
      console.error('Error details:', err.response?.data);
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

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');

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
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
        },
      });

      const reportData = Array.isArray(response.data.reports) ? response.data.reports : [response.data];

      setUsers(reportData.map((report) => ({
        code: report.code || '',
        employeeName: report.employeeName || 'غير معروف',
        department: report.department || '',
        baseBonus: Number(report.baseBonus || 0),
        bonusPercentage: Number(report.bonusPercentage || 0),
        workDaysPerWeek: Number(report.workDaysPerWeek || 6),
        totalWorkDays: Number(report.totalWorkDays || 0),
        absences: Number(report.absences || 0),
        annualLeave: Number(report.annualLeave || 0),
        medicalLeave: Number(report.medicalLeave || 0),
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
      console.error('Error details:', err.response?.data);
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
    });
    setError('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');

    if (!startDate.isValid || !endDate.isValid) {
      setError('تاريخ البداية أو النهاية غير صالح');
      return;
    }

    if (startDate > endDate) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

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

    if (Number(tieUpValue) < Number(editingUser.tieUpValue)) {
      setError('قيمة التربيط يجب ألا تقل عن القيمة الحالية');
      return;
    }
    if (Number(deductions) < Number(editingUser.deductions)) {
      setError('الاستقطاعات يجب ألا تقل عن القيمة الحالية');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const requestData = {
        code: editForm.code,
        tieUpValue: Number(tieUpValue),
        productionValue: Number(productionValue),
        advances: Number(advances),
        deductions: Number(deductions),
        dateFrom: startDate.toISODate(),
        dateTo: endDate.toISODate(),
      };

      console.log('Request Data:', requestData);

      let response;
      try {
        response = await axios.put(
          `${process.env.REACT_APP_API_URL}/api/bonus-reports/${editForm.code}`,
          requestData,
          {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'Cache-Control': 'no-cache',
            },
          }
        );
      } catch (err) {
        if (err.response?.status === 404 && err.response?.data?.error === 'التقرير غير موجود') {
          response = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/bonus-reports`,
            requestData,
            {
              headers: { 
                Authorization: `Bearer ${localStorage.getItem('token')}`,
                'Cache-Control': 'no-cache',
              },
            }
          );
        } else {
          throw err;
        }
      }

      console.log('Server Response:', response.data);

      setUsers((prev) =>
        prev.map((u) =>
          u.code === editForm.code &&
          u.dateFrom === startDate.toISODate() &&
          u.dateTo === endDate.toISODate()
            ? {
                ...u,
                tieUpValue: Number(response.data.report.tieUpValue || tieUpValue),
                productionValue: Number(response.data.report.productionValue || productionValue),
                advances: Number(response.data.report.advances || advances),
                deductions: Number(response.data.report.deductions || deductions),
                netBonus: Number(response.data.report.netBonus || 0),
              }
            : u
        )
      );

      setEditingUser(null);
      setEditForm({});
      triggerSuccessAnimation();
      await refreshData(); // تحديث البيانات بعد التعديل
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message;
      console.error('Edit Error:', errorMsg);
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

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' }).startOf('month');
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' }).endOf('month');

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
              headers: { 
                Authorization: `Bearer ${localStorage.getItem('token')}`,
                'Cache-Control': 'no-cache',
              },
            }
          )
        )
      );
      triggerSuccessAnimation();
      await refreshData(); // تحديث البيانات بعد الحفظ
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message;
      console.error('Save Error:', errorMsg);
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
      'الإجازة الطبية',
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
      user.medicalLeave,
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

    worksheet['!rtl'] = false;
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
          if ([currentUser.role === 'admin' ? 0 : 3, 1, 2, 3, 4, 9, 10, 11, 12].includes(col)) {
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
                    'الإجازة الطبية',
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
                        width: { size: 100 / (currentUser.role === 'admin' ? 16 : 13), type: WidthType.PERCENTAGE },
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
                        user.medicalLeave.toString(),
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
                            width: { size: 100 / (currentUser.role === 'admin' ? 16 : 13), type: WidthType.PERCENTAGE },
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
                    users.reduce((sum, user) => sum + Number(user.medicalLeave || 0), 0).toString(),
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
                        width: { size: 100 / (currentUser.role === 'admin' ? 16 : 13), type: WidthType.PERCENTAGE },
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
    <div className="min-h-screen bg-gray-100 flex flex-col font-amiri">
      <NavBar />
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <AnimatePresence>
          {loading && <LoadingSpinner />}
          {showSuccess && <SuccessCheckmark />}
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6"
        >
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 text-right flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-teal-500" />
            تقرير الحافز الشهري
          </h2>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-right"
            >
              {error}
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {currentUser.role === 'admin' && (
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                  كود الموظف
                </label>
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  placeholder="أدخل كود الموظف"
                />
              </div>
            )}
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                من تاريخ
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-right"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-right"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              onClick={handleSearch}
              className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
            >
              بحث
            </button>
            {currentUser.role === 'admin' && (
              <button
                onClick={handleShowAll}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                عرض الكل
              </button>
            )}
            {currentUser.role === 'admin' && users.length > 0 && (
              <button
                onClick={handleSaveReport}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
              >
                حفظ التقرير
              </button>
            )}
            {users.length > 0 && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition"
                >
                  تصدير إلى Excel
                </button>
                <button
                  onClick={handleExportWord}
                  className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition"
                >
                  تصدير إلى Word
                </button>
                <button
                  onClick={refreshData}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition"
                >
                  تحديث البيانات
                </button>
              </>
            )}
          </div>
        </motion.div>

        {users.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-right table-auto">
              <thead>
                <tr className="bg-teal-500 text-white">
                  {currentUser.role === 'admin' && (
                    <>
                      <th className="p-3 font-semibold">كود الموظف</th>
                      <th className="p-3 font-semibold">الاسم</th>
                      <th className="p-3 font-semibold">القسم</th>
                    </>
                  )}
                  <th className="p-3 font-semibold">الحافز الأساسي</th>
                  <th className="p-3 font-semibold">نسبة الحافز</th>
                  <th className="p-3 font-semibold">أيام العمل الأسبوعية</th>
                  <th className="p-3 font-semibold">إجمالي أيام العمل</th>
                  <th className="p-3 font-semibold">الغياب</th>
                  <th className="p-3 font-semibold">الإجازة السنوية</th>
                  <th className="p-3 font-semibold">الإجازة الطبية</th>
                  <th className="p-3 font-semibold">إجمالي الإجازات</th>
                  <th className="p-3 font-semibold">قيمة التربيط</th>
                  <th className="p-3 font-semibold">قيمة الإنتاج</th>
                  <th className="p-3 font-semibold">السلف</th>
                  <th className="p-3 font-semibold">الاستقطاعات</th>
                  <th className="p-3 font-semibold">صافي الحافز</th>
                  {currentUser.role === 'admin' && (
                    <th className="p-3 font-semibold">الإجراءات</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr
                    key={`${user.code}-${user.dateFrom}`}
                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                  >
                    {currentUser.role === 'admin' && (
                      <>
                        <td className="p-3">{user.code}</td>
                        <td className="p-3">{user.employeeName}</td>
                        <td className="p-3">{user.department}</td>
                      </>
                    )}
                    <td className="p-3">{Number(user.baseBonus).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">{Number(user.bonusPercentage).toFixed(2)}%</td>
                    <td className="p-3">{user.workDaysPerWeek}</td>
                    <td className="p-3">{user.totalWorkDays}</td>
                    <td className="p-3">{user.absences}</td>
                    <td className="p-3">{user.annualLeave}</td>
                    <td className="p-3">{user.medicalLeave}</td>
                    <td className="p-3">{user.totalLeaveDays}</td>
                    <td className="p-3">{Number(user.tieUpValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">{Number(user.productionValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">{Number(user.advances).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">{Number(user.deductions).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">{Number(user.netBonus).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    {currentUser.role === 'admin' && (
                      <td className="p-3">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="text-blue-500 hover:underline"
                        >
                          تعديل
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-blue-100 font-bold">
                  {currentUser.role === 'admin' && (
                    <>
                      <td className="p-3">-</td>
                      <td className="p-3">الإجمالي</td>
                      <td className="p-3">-</td>
                    </>
                  )}
                  <td className="p-3">-</td>
                  <td className="p-3">-</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.workDaysPerWeek || 0), 0)}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.totalWorkDays || 0), 0)}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.absences || 0), 0)}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.annualLeave || 0), 0)}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.medicalLeave || 0), 0)}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.totalLeaveDays || 0), 0)}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.tieUpValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.productionValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.advances || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.deductions || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3">{users.reduce((sum, user) => sum + Number(user.netBonus || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  {currentUser.role === 'admin' && <td className="p-3">-</td>}
                </tr>
              </tbody>
            </table>
          </motion.div>
        )}

        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4 text-right">
                تعديل تقرير الموظف: {editingUser.employeeName}
              </h3>
              <form onSubmit={handleEditSubmit}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                    قيمة التربيط
                  </label>
                  <input
                    type="number"
                    name="tieUpValue"
                    value={editForm.tieUpValue}
                    onChange={handleEditChange}
                    step="0.01"
                    min={Number(editingUser.tieUpValue || 0).toFixed(2)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                    قيمة الإنتاج
                  </label>
                  <input
                    type="number"
                    name="productionValue"
                    value={editForm.productionValue}
                    onChange={handleEditChange}
                    step="0.01"
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                    السلف
                  </label>
                  <input
                    type="number"
                    name="advances"
                    value={editForm.advances}
                    onChange={handleEditChange}
                    step="0.01"
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                    الاستقطاعات
                  </label>
                  <input
                    type="number"
                    name="deductions"
                    value={editForm.deductions}
                    onChange={handleEditChange}
                    step="0.01"
                    min={Number(editingUser.deductions || 0).toFixed(2)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    type="submit"
                    className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={handleEditCancel}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MonthlyBonusReport;
