FROM node:18-alpine

# إعداد دليل العمل
WORKDIR /app

# نسخ ملفات package.json وتثبيت التبعيات
COPY package*.json ./
RUN npm install

# نسخ باقي ملفات التطبيق
COPY . .

# إنشاء دليل Uploads
RUN mkdir -p /app/Uploads

# تحديد Volume لتخزين الملفات
VOLUME /app/Uploads

# تعيين المنفذ
EXPOSE 3000

# أمر تشغيل التطبيق
CMD ["npm", "start"]
