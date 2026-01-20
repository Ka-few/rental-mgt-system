# Rental Management System

A comprehensive desktop application for managing rental properties, tenants, and finances built with Electron, React, and SQLite.

## 🌟 Features

### Core Functionality
- **Tenant Management** - Add, edit, and track tenants with full contact information
- **Property & Unit Management** - Manage multiple properties and rental units
- **Financial Tracking** - Record payments, charges, and view tenant balances
- **Maintenance Requests** - Track and manage property maintenance
- **Automated Rent Run** - Generate monthly rent charges for all active tenants
- **Reports & Analytics** - Financial summaries, occupancy reports, and debtors list
- **Data Export** - Export reports to Excel for external use

### Advanced Features
- **Dashboard Analytics** - Revenue trends and occupancy charts
- **Search & Filter** - Quickly find tenants by name, ID, or phone
- **User Management** - Securely change passwords from the Settings page
- **Toast Notifications** - Professional feedback for all actions
- **Database Backup** - Download and restore your data
- **Receipt Printing** - Generate payment receipts with company branding

## 🚀 Installation

### For End Users

1. **Download** the installer for your platform:
   - Windows: `Rental-Management-Setup-1.0.0.exe`
   - Linux: `Rental-Management-1.0.0.AppImage`
   - macOS: `Rental-Management-1.0.0.dmg`

2. **Run** the installer and follow the prompts

3. **Launch** the application

4. **Login** with default credentials:
   - Username: `admin`
   - Password: `admin123`
   - ⚠️ **Important**: Change the default password after first login

### For Developers

```bash
# Clone the repository
git clone https://github.com/Ka-few/rental-mgt-system.git
cd rental-mgt-system

# Install dependencies
npm install
npm install --prefix src

# Run in development mode (web version)
npm run web

# Run in development mode (Electron)
npm run dev

# Build for production
npm run build --prefix src
npm run build
```

## 💻 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Desktop**: Electron
- **Charts**: Recharts
- **Export**: XLSX (SheetJS)

## 📖 User Guide

### First Time Setup

1. **Login** with admin credentials
2. **Configure Settings**:
   - Go to Settings page
   - Add your company name, address, and phone
   - These will appear on receipts
3. **Add Properties**:
   - Navigate to Properties page
   - Create your first property
   - Add units to the property
4. **Add Tenants**:
   - Go to Tenants page
   - Add tenant information
   - Assign them to a unit

### Daily Operations

**Recording a Payment**:
1. Go to Finance page
2. Click "Record Payment"
3. Select tenant, enter amount and payment method
4. Click "Submit"
5. Print receipt if needed

**Running Monthly Rent**:
1. Go to Finance page
2. Click "Run Monthly Rent"
3. Confirm the action
4. Rent charges will be created for all active tenants

**Viewing Reports**:
1. Go to Reports page
2. Select report type (Financial, Occupancy, Debtors)
3. Apply filters if needed
4. Click "Export to Excel" to download

### Backup & Restore

**Creating a Backup**:
1. Go to Settings page
2. Click "Download Database Backup"
3. Save the file to a safe location
4. **Recommended**: Keep multiple backups in different locations

**Restoring from Backup**:
1. Close the application
2. Navigate to the database location:
   - Windows: `%APPDATA%/rental-mgt-system/`
   - Linux: `~/.config/rental-mgt-system/`
   - macOS: `~/Library/Application Support/rental-mgt-system/`
3. Replace `rental.db` with your backup file
4. Restart the application

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT-based authentication
- Protected API routes
- Input validation on all forms
- Database stored locally (not cloud)

## 📊 System Requirements

### Minimum
- **OS**: Windows 10, Ubuntu 20.04, or macOS 10.15+
- **RAM**: 2GB
- **Storage**: 100MB free space
- **Display**: 1280x720 resolution

### Recommended
- **OS**: Windows 11, Ubuntu 22.04, or macOS 12+
- **RAM**: 4GB
- **Storage**: 500MB free space
- **Display**: 1920x1080 resolution

## 🐛 Troubleshooting

### Application won't start
- Check if port 3000 is already in use
- Try running as administrator (Windows)
- Check antivirus isn't blocking the app

### Database errors
- Ensure you have write permissions to the app data folder
- Try restoring from a backup
- Check disk space availability

### Can't login
- Default credentials: admin / admin123
- If changed and forgotten, you'll need to reset the database

## 📞 Support

For issues, questions, or feature requests:
- **Email**: support@yourcompany.com
- **GitHub Issues**: https://github.com/Ka-few/rental-mgt-system/issues

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with modern web technologies and best practices for desktop application development.

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Developed by**: Ka-few
