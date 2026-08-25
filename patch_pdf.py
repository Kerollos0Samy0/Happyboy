import os
import re

def refactor_orders_page():
    path = r"E:\Files\Stock HappyBoy\src\app\admin\orders\page.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Refactor generatePDF
    old_gen = """      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      let heightLeft = imgHeight;
      let position = margin;
      
      pdf.addImage(imgData, "JPEG", margin, position, printWidth, imgHeight);
      
      // Cover margins with white rectangles to prevent bleeding from previous page
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, margin, 'F');
      pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
      
      heightLeft -= printHeight;
      
      while (heightLeft > 0) {
        position -= printHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, printWidth, imgHeight);
        
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, 'F');
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
        
        heightLeft -= printHeight;
      }
      
      return pdf;"""

    new_gen = """      const pages = invoiceEl.querySelectorAll('.invoice-page');
      
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const pageCanvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: pageEl.scrollWidth,
          windowHeight: pageEl.scrollHeight
        });
        
        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const ratio = printWidth / pageCanvas.width;
        const pageImgHeight = pageCanvas.height * ratio;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, margin, printWidth, pageImgHeight);
      }
      
      return pdf;"""
    
    # We also need to remove the first html2canvas call inside generatePDF that takes the whole invoiceEl
    # Let's replace the whole try block
    
    old_try = """    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: invoiceEl.scrollWidth,
        windowHeight: invoiceEl.scrollHeight
      });
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const margin = 10; // 1cm margin
      const printWidth = pdfWidth - (margin * 2);
      const printHeight = pdfHeight - (margin * 2);
      
      const ratio = printWidth / canvas.width;
      const imgHeight = canvas.height * ratio;
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      let heightLeft = imgHeight;
      let position = margin;
      
      pdf.addImage(imgData, "JPEG", margin, position, printWidth, imgHeight);
      
      // Cover margins with white rectangles to prevent bleeding from previous page
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, margin, 'F');
      pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
      
      heightLeft -= printHeight;
      
      while (heightLeft > 0) {
        position -= printHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, printWidth, imgHeight);
        
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, 'F');
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
        
        heightLeft -= printHeight;
      }
      
      return pdf;
    } finally {"""

    new_try = """    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      
      const pdfWidth = 210; // A4 width in mm
      const margin = 10; // 1cm margin
      const printWidth = pdfWidth - (margin * 2);
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pages = invoiceEl.querySelectorAll('.invoice-page');
      
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const pageCanvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: pageEl.scrollWidth,
          windowHeight: pageEl.scrollHeight
        });
        
        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const ratio = printWidth / pageCanvas.width;
        const pageImgHeight = pageCanvas.height * ratio;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, margin, printWidth, pageImgHeight);
      }
      
      return pdf;
    } finally {"""

    content = content.replace(old_try, new_try)

    # Now refactor the invoiceRef JSX
    # We will find `<div\n        ref={invoiceRef}` and replace down to the closing tag of the condition.
    old_jsx_start = '<div\n        ref={invoiceRef}'
    
    # Let's just do a regex substitution for the items mapping
    
    # Find the table element and the mapping inside it
    table_regex = re.compile(r'<table.*?</table>', re.DOTALL)
    
    # We want to replace the whole `{selectedOrder && (` block
    # It's easier to replace the entire `ref={invoiceRef}` div with a python script replacing the file content manually.

refactor_orders_page()
