export function renderFullScreenDocumentViewer(attachmentOrUrl: any, title?: string) {
  // Remove existing viewer if open
  const existing = document.getElementById('globalFullScreenDocumentOverlay');
  if (existing) {
    existing.remove();
  }

  if (!attachmentOrUrl) attachmentOrUrl = {};

  // Extract raw filename accurately (file.name > fileName > name > title)
  const rawFileName = (typeof attachmentOrUrl === 'object'
    ? (attachmentOrUrl.file ? attachmentOrUrl.file.name : '') || attachmentOrUrl.fileName || attachmentOrUrl.name
    : typeof attachmentOrUrl === 'string' ? attachmentOrUrl : '') || title || 'Attachment';

  const displayTitle = title || (typeof attachmentOrUrl === 'object' ? attachmentOrUrl.name || attachmentOrUrl.fileName || rawFileName : '') || rawFileName || 'Attachment';

  let url = typeof attachmentOrUrl === 'string' ? attachmentOrUrl : '';

  if (!url && typeof attachmentOrUrl === 'object' && attachmentOrUrl !== null) {
    if (attachmentOrUrl.file instanceof File) {
      try {
        url = URL.createObjectURL(attachmentOrUrl.file);
      } catch (e) {}
    }
    if (!url) {
      url = attachmentOrUrl.fileUrl || attachmentOrUrl.url || attachmentOrUrl.preview ||
            attachmentOrUrl.data || attachmentOrUrl.fileData || attachmentOrUrl.path || '';
    }
    if (!url) {
      const fn = attachmentOrUrl.fileName || attachmentOrUrl.name;
      if (fn) {
        try {
          const cached = sessionStorage.getItem(`ep_att_${fn}`);
          if (cached) url = cached;
        } catch (e) {}
      }
    }
  }

  // If url is just a raw filename like "Invoice (2).pdf" without path
  const isPlainFileName = url && !url.includes('/') && !url.includes('\\') && !url.startsWith('data:') && !url.startsWith('blob:');
  if (isPlainFileName) {
    url = `https://lcgc-rfq.onrender.com/uploads/${url}`;
  } else if (!url && rawFileName && rawFileName.includes('.') && !rawFileName.endsWith('...')) {
    url = `https://lcgc-rfq.onrender.com/uploads/${rawFileName}`;
  }

  if (url && typeof url === 'string') {
    url = url.replace(/\\/g, '/');
    if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      url = url.startsWith('/')
        ? `https://lcgc-rfq.onrender.com${url}`
        : `https://lcgc-rfq.onrender.com/${url}`;
    }
  }

  const lowerName = rawFileName.toLowerCase();
  const lowerUrl = (url || '').toLowerCase();

  let mime = '';
  if (url && url.startsWith('data:')) {
    const mimeMatch = url.match(/^data:([^;]+)/);
    mime = mimeMatch ? mimeMatch[1].toLowerCase() : '';
  } else if (typeof attachmentOrUrl === 'object' && attachmentOrUrl.file instanceof File) {
    mime = (attachmentOrUrl.file.type || '').toLowerCase();
  } else if (typeof attachmentOrUrl === 'object' && (attachmentOrUrl as any).fileType) {
    mime = ((attachmentOrUrl as any).fileType || '').toLowerCase();
  }

  // Robust detection for Images
  const isImage = /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(lowerName) ||
                  /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(lowerUrl) ||
                  mime.startsWith('image/');

  // Robust detection for PDFs
  const isPdf = /\.pdf($|\?)/i.test(lowerName) ||
                lowerUrl.includes('.pdf') ||
                mime === 'application/pdf' ||
                (url && url.startsWith('data:application/pdf')) ||
                (!isImage && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(rawFileName));

  // Robust detection for Excel, Word, PPT, CSV
  const isExcel = /\.(xlsx|xls)($|\?)/i.test(lowerName) || /\.(xlsx|xls)($|\?)/i.test(lowerUrl) || mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('officedocument.spreadsheetml');
  const isWord = /\.(docx|doc)($|\?)/i.test(lowerName) || /\.(docx|doc)($|\?)/i.test(lowerUrl) || mime.includes('word') || mime.includes('officedocument.wordprocessingml');
  const isPpt = /\.(pptx|ppt)($|\?)/i.test(lowerName) || /\.(pptx|ppt)($|\?)/i.test(lowerUrl) || mime.includes('powerpoint') || mime.includes('presentation');
  const isCsv = /\.csv($|\?)/i.test(lowerName) || lowerUrl.includes('.csv') || mime.includes('csv');

  let pdfViewerUrl = url;
  if (isPdf && url.startsWith('data:')) {
    try {
      const base64Data = url.split(',')[1];
      const bytes = atob(base64Data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      pdfViewerUrl = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    } catch (e) {}
  }

  const overlay = document.createElement('div');
  overlay.id = 'globalFullScreenDocumentOverlay';
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: rgba(15, 23, 42, 0.75) !important;
    backdrop-filter: blur(6px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    padding: 20px !important;
    box-sizing: border-box !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: #ffffff !important;
    border-radius: 16px !important;
    width: 90vw !important;
    max-width: 980px !important;
    height: 85vh !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4) !important;
  `;

  const safeTitle = escapeHtml(displayTitle);
  const safeUrl = escapeHtml(url);

  let bodyHtml = '';
  if (isImage && url) {
    bodyHtml = `
      <div style="flex: 1; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 20px; box-sizing: border-box; width: 100%;">
        <img id="modalPreviewImg" src="${safeUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" alt="Image Preview">
      </div>
    `;
  } else if (isPdf && pdfViewerUrl) {
    bodyHtml = `
      <div style="flex: 1; background: #1e293b; width: 100%; padding: 12px; box-sizing: border-box;">
        <iframe src="${escapeHtml(pdfViewerUrl)}" style="width: 100%; height: 100%; border: none; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></iframe>
      </div>
    `;
  } else if ((isExcel || isWord || isPpt) && url && url.startsWith('http')) {
    const officeEmbedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    bodyHtml = `
      <div style="flex: 1; background: #f8fafc; width: 100%; height: calc(100% - 56px);">
        <iframe src="${escapeHtml(officeEmbedUrl)}" style="width: 100%; height: 100%; border: none; background: white;"></iframe>
      </div>
    `;
  } else if (isCsv && url && url.startsWith('data:')) {
    // Render CSV live data table
    let csvRows: string[][] = [];
    try {
      const base64Data = url.split(',')[1];
      const csvText = atob(base64Data);
      const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
      csvRows = lines.slice(0, 100).map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
    } catch (e) {}

    if (csvRows.length > 0) {
      const headerRow = csvRows[0];
      const dataRows = csvRows.slice(1);
      const ths = headerRow.map(h => `<th style="background: #1e293b; color: white; padding: 10px 14px; font-size: 13px; text-align: left; border: 1px solid #334155;">${escapeHtml(h)}</th>`).join('');
      const trs = dataRows.map(row => {
        const tds = row.map(cell => `<td style="padding: 8px 14px; font-size: 13px; color: #334155; border: 1px solid #e2e8f0;">${escapeHtml(cell)}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');

      bodyHtml = `
        <div style="flex: 1; background: #ffffff; width: 100%; overflow: auto; padding: 16px; box-sizing: border-box;">
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>
      `;
    } else {
      bodyHtml = renderOfficeCardHtml(safeTitle, safeUrl, '📊 CSV Spreadsheet');
    }
  } else if (isExcel) {
    bodyHtml = renderOfficeCardHtml(safeTitle, safeUrl, '📊 Excel Spreadsheet (.xlsx / .xls)', '#059669', '🟢');
  } else if (isWord) {
    bodyHtml = renderOfficeCardHtml(safeTitle, safeUrl, '📝 Word Document (.docx / .doc)', '#2563eb', '🔵');
  } else if (isPpt) {
    bodyHtml = renderOfficeCardHtml(safeTitle, safeUrl, '📊 PowerPoint Presentation (.pptx / .ppt)', '#d97706', '🟠');
  } else {
    bodyHtml = renderOfficeCardHtml(safeTitle, safeUrl, '📁 Document File');
  }

  card.innerHTML = `
    <div style="background: #0f172a; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; height: 56px; box-sizing: border-box; flex-shrink: 0; width: 100%;">
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <span style="font-size: 20px;">📄</span>
        <span style="font-weight: 700; font-size: 15px; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50vw;">${safeTitle}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 14px;">
        ${url ? `<a href="${safeUrl}" download target="_blank" style="background: #2563eb; color: white; text-decoration: none; padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.4);">⬇ Download</a>` : ''}
        <button id="btnModalCloseHeader" style="background: rgba(255,255,255,0.15); border: none; color: white; font-size: 24px; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.2s;" title="Close (ESC)">✕</button>
      </div>
    </div>
    ${bodyHtml}
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const closeViewer = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeViewer();
    }
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) closeViewer();
  };

  document.addEventListener('keydown', handleEsc);

  const btnClose = document.getElementById('btnModalCloseHeader');
  if (btnClose) btnClose.onclick = closeViewer;

  const btnFallbackClose = document.getElementById('btnModalCloseFallback');
  if (btnFallbackClose) btnFallbackClose.onclick = closeViewer;
}

function renderOfficeCardHtml(title: string, url: string, fileTypeName: string, accentColor = '#2563eb', iconEmoji = '📑'): string {
  return `
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; padding: 40px; box-sizing: border-box; text-align: center; width: 100%;">
      <div style="font-size: 80px; margin-bottom: 16px;">${iconEmoji}</div>
      <span style="background: ${accentColor}15; color: ${accentColor}; font-weight: 700; padding: 4px 14px; border-radius: 20px; font-size: 13px; margin-bottom: 12px; display: inline-block;">
        ${fileTypeName}
      </span>
      <h3 style="color: #0f172a; margin-bottom: 8px; font-size: 22px; font-weight: 700; max-width: 500px; overflow: hidden; text-overflow: ellipsis;">${title}</h3>
      <p style="color: #64748b; margin-bottom: 28px; font-size: 14px; max-width: 440px; line-height: 1.5;">
        This document can be downloaded and opened directly in your office desktop application.
      </p>
      <div style="display: flex; gap: 14px; align-items: center;">
        ${url ? `<a href="${url}" download target="_blank" style="background: ${accentColor}; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px ${accentColor}40; display: inline-flex; align-items: center; gap: 8px;">⬇️ Download & Open Document</a>` : ''}
        <button id="btnModalCloseFallback" style="background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer;">✖ Close</button>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
