/**
 * تصدير Excel احترافي — تقرير اهتمامات الدورات
 */
(function (global) {
    "use strict";

    var COLS = 5;
    var LAST_COL = "E";

    function downloadBuffer(buffer, filename) {
        var blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function cleanFilterLabel(label) {
        return String(label || "جميع الدورات").replace(/\s*\(\d+\)\s*$/, "").trim();
    }

    function safeFilePart(text) {
        return String(text || "الكل").replace(/[\\/:*?"<>|]/g, "_").substring(0, 40);
    }

    function applyBorder(cell, style) {
        cell.border = {
            top: style,
            left: style,
            bottom: style,
            right: style
        };
    }

    function thinBorder() {
        return { style: "thin", color: { argb: "FFD1D5DB" } };
    }

    function headerBorder() {
        return { style: "thin", color: { argb: "FF1E3A8A" } };
    }

    function mergeMetaRow(sheet, rowNum, label, value) {
        sheet.mergeCells("A" + rowNum + ":B" + rowNum);
        sheet.mergeCells("C" + rowNum + ":" + LAST_COL + rowNum);
        var labelCell = sheet.getCell("A" + rowNum);
        var valueCell = sheet.getCell("C" + rowNum);
        labelCell.value = label;
        valueCell.value = value;
        labelCell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FF334155" } };
        labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        labelCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
        valueCell.font = { name: "Arial", size: 11, color: { argb: "FF0F172A" } };
        valueCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
        applyBorder(labelCell, thinBorder());
        applyBorder(valueCell, thinBorder());
        sheet.getRow(rowNum).height = 24;
    }

    global.maherExportInterestsExcel = async function (opts) {
        if (!global.ExcelJS) {
            alert("تعذّر تحميل مكتبة Excel. حدّث الصفحة وحاول مرة أخرى.");
            return;
        }

        var rows = (opts && opts.rows) || [];
        if (!rows.length) {
            alert("لا توجد بيانات للتصدير.");
            return;
        }

        var fmtDate = (opts && opts.fmtDate) || function (d) { return d ? String(d) : "—"; };
        var filterLabel = cleanFilterLabel(opts && opts.filterLabel);
        var now = new Date();
        var dateStr = now.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
        var timeStr = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

        var wb = new global.ExcelJS.Workbook();
        wb.creator = "أكاديمية ماهر للتدريب";
        wb.created = now;

        var sheet = wb.addWorksheet("اهتمامات الدورات", {
            views: [{ rightToLeft: true, state: "frozen", ySplit: 9 }],
            properties: { defaultRowHeight: 22 }
        });

        sheet.columns = [
            { key: "idx", width: 7 },
            { key: "name", width: 26 },
            { key: "phone", width: 17 },
            { key: "course", width: 48 },
            { key: "date", width: 20 }
        ];

        /* ── ترويسة التقرير ── */
        sheet.mergeCells("A1:" + LAST_COL + "1");
        var title1 = sheet.getCell("A1");
        title1.value = "أكاديمية ماهر للتدريب";
        title1.font = { name: "Arial", bold: true, size: 18, color: { argb: "FFFFFFFF" } };
        title1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A33B8" } };
        title1.alignment = { vertical: "middle", horizontal: "center" };
        sheet.getRow(1).height = 36;

        sheet.mergeCells("A2:" + LAST_COL + "2");
        var title2 = sheet.getCell("A2");
        title2.value = "تقرير المهتمين بالدورات التدريبية";
        title2.font = { name: "Arial", bold: true, size: 13, color: { argb: "FF1E3A8A" } };
        title2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
        title2.alignment = { vertical: "middle", horizontal: "center" };
        sheet.getRow(2).height = 28;

        sheet.getRow(3).height = 8;

        mergeMetaRow(sheet, 4, "تاريخ التصدير", dateStr + " — " + timeStr);
        mergeMetaRow(sheet, 5, "نطاق التصفية", filterLabel);
        mergeMetaRow(sheet, 6, "إجمالي السجلات", String(rows.length));

        sheet.getRow(7).height = 10;

        /* ── عناوين الجدول ── */
        var headers = ["#", "اسم الطالب", "رقم الجوال", "اسم الدورة", "تاريخ تسجيل الاهتمام"];
        var headerRowNum = 8;
        headers.forEach(function (h, i) {
            var cell = sheet.getCell(headerRowNum, i + 1);
            cell.value = h;
            cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
            cell.alignment = {
                vertical: "middle",
                horizontal: i === 0 || i === 2 ? "center" : "right",
                wrapText: true
            };
            applyBorder(cell, headerBorder());
        });
        sheet.getRow(headerRowNum).height = 28;

        /* ── بيانات الجدول ── */
        rows.forEach(function (r, i) {
            var rowNum = headerRowNum + 1 + i;
            var values = [
                i + 1,
                r.full_name || "—",
                r.phone || "—",
                r.course_title || "—",
                fmtDate(r.created_at)
            ];
            var zebra = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";

            values.forEach(function (val, c) {
                var cell = sheet.getCell(rowNum, c + 1);
                cell.value = val;
                cell.font = { name: "Arial", size: 11, color: { argb: "FF0F172A" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
                cell.alignment = {
                    vertical: "middle",
                    horizontal: c === 0 || c === 2 ? "center" : "right",
                    wrapText: c === 3
                };
                applyBorder(cell, thinBorder());
                if (c === 2 && r.phone) {
                    cell.numFmt = "@";
                }
            });
            sheet.getRow(rowNum).height = (r.course_title || "").length > 42 ? 36 : 24;
        });

        /* ── تذييل ── */
        var footerRow = headerRowNum + 1 + rows.length + 1;
        sheet.mergeCells("A" + footerRow + ":" + LAST_COL + footerRow);
        var footer = sheet.getCell("A" + footerRow);
        footer.value = "© أكاديمية ماهر للتدريب — تقرير داخلي — " + dateStr;
        footer.font = { name: "Arial", italic: true, size: 9, color: { argb: "FF64748B" } };
        footer.alignment = { vertical: "middle", horizontal: "center" };
        sheet.getRow(footerRow).height = 20;

        var buffer = await wb.xlsx.writeBuffer();
        var fileDate = now.toISOString().slice(0, 10);
        downloadBuffer(buffer, "اهتمامات_دورات_" + safeFilePart(filterLabel) + "_" + fileDate + ".xlsx");
    };
})(window);
