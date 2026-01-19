import * as XLSX from 'xlsx';

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 * @param {string} sheetName - Name of the worksheet
 */
export const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
    try {
        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Convert data to worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Generate file and trigger download
        XLSX.writeFile(wb, `${filename}.xlsx`);

        return { success: true };
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 */
export const exportToCSV = (data, filename) => {
    try {
        // Convert data to worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Convert worksheet to CSV
        const csv = XLSX.utils.sheet_to_csv(ws);

        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return { success: true };
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Format data for export by cleaning and transforming fields
 * @param {Array} data - Raw data array
 * @param {Object} fieldMap - Map of field names to display names
 */
export const formatDataForExport = (data, fieldMap = {}) => {
    return data.map(item => {
        const formatted = {};
        Object.keys(item).forEach(key => {
            const displayName = fieldMap[key] || key;
            let value = item[key];

            // Format dates
            if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                value = new Date(value).toLocaleDateString();
            }

            // Format null/undefined
            if (value === null || value === undefined) {
                value = '-';
            }

            formatted[displayName] = value;
        });
        return formatted;
    });
};
