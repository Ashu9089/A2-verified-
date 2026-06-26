(function () {
  'use strict';

  const SUPABASE_URL = 'https://tovpcbzztvkiwamimrxt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdnBjYnp6dHZraXdhbWltcnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTYwMzAsImV4cCI6MjA5NDA3MjAzMH0.utU3KsVOdSzl2Q6ay6-HlB_7RgzEGUMvasFfWclW4XE';

  const $ = id => document.getElementById(id);

  const empHeader = $('empHeaderInfo');
  const featureNotice = $('featureNotice');
  const leaveForm = $('leaveForm');
  const fromDateInput = $('fromDate');
  const toDateInput = $('toDate');
  const daysCountSpan = $('daysCountDisplay');
  const leaveTypeSelect = $('leaveType');
  const reasonTextarea = $('reasonText');
  const docUploadInput = $('docUpload');
  const searchInput = $('handoverSearchInput');
  const suggestionsDiv = $('suggestionsContainer');
  const selectedHandoverDiv = $('selectedHandoverDetail');
  const submitBtn = $('submitLeaveBtn');
  const historyContainer = $('leaveHistoryList');
  const handoverList = $('handoverList');
  const backArrow = $('backArrowBtn');

  const params = new URLSearchParams(window.location.search);

  function todayYmd() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function initDateLimits() {
    const today = todayYmd();
    fromDateInput.min = today;
    toDateInput.min = today;

    if (fromDateInput.value && fromDateInput.value < today) fromDateInput.value = '';
    if (toDateInput.value && toDateInput.value < today) toDateInput.value = '';

    updateDays();
  }

  function pickValue() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  const state = {
    orgCode: pickValue(params.get('org_code'), params.get('orgCode'), localStorage.getItem('org_code'), localStorage.getItem('orgCode'), localStorage.getItem('current_org_code')),
    empCode: pickValue(params.get('emp_code'), params.get('empCode'), localStorage.getItem('emp_code'), localStorage.getItem('empCode'), localStorage.getItem('current_emp_code')),
    email: pickValue(params.get('email'), localStorage.getItem('email'), localStorage.getItem('current_email')),
    mobile: pickValue(params.get('mobile'), localStorage.getItem('mobile'), localStorage.getItem('current_mobile')),
    returnPage: pickValue(params.get('return_page'), localStorage.getItem('return_page'), 'emp.html'),
    employee: null,
    organization: null,
    employees: [],
    leaves: [],
    handovers: [],
    selectedHandover: null,
    featureEnabled: true
  };

  function makeClient() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library load nahi hui. Internet/CDN check karein.');
    }
    if (!window.inlistSb) {
      window.inlistSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.inlistSb;
  }

  const sb = makeClient();

  function toast(msg, err) {
    const old = document.querySelector('.toast');
    if (old) old.remove();

    const div = document.createElement('div');
    div.className = 'toast' + (err ? ' err' : '');
    div.textContent = msg;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
  }

  function friendlyError(error) {
    const msg = String((error && (error.message || error.details || error.hint)) || error || '');

    if (msg.includes('PENDING_LEAVE_EXISTS')) {
      return 'Pehle wali leave approve, cancel ya reject hone tak dusri leave apply nahi hogi.';
    }

    if (
      msg.includes('DUPLICATE_LEAVE_REQUEST') ||
      msg.includes('ALREADY_APPLIED') ||
      msg.includes('duplicate key value')
    ) {
      return 'Is date par leave already apply hai. Same date ya applied date range me dobara leave nahi lagegi.';
    }

    if (msg.includes('PREVIOUS_DATE_NOT_ALLOWED')) return 'Previous date par leave apply nahi kar sakte.';
    if (msg.includes('ORG_NOT_FOUND')) return 'Organization nahi mila. Login/session check karein.';
    if (msg.includes('EMPLOYEE_NOT_FOUND')) return 'Employee nahi mila. Login/session check karein.';
    if (msg.includes('HANDOVER_EMPLOYEE_NOT_FOUND')) return 'Handover employee nahi mila.';
    if (msg.includes('INVALID_DATE_RANGE')) return 'Date range galat hai.';

    return msg || 'Something went wrong.';
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (s) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[s];
    });
  }

  function attr(v) {
    return esc(v);
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN');
  }

  function cleanStatus(s) {
    return String(s || 'handover_pending').toLowerCase();
  }

  function statusText(s) {
    const status = cleanStatus(s);
    const map = {
      handover_pending: 'HANDOVER PENDING',
      pending_handover: 'HANDOVER PENDING',
      admin_pending: 'ADMIN PENDING',
      pending_admin: 'ADMIN PENDING',
      pending: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      cancelled: 'CANCELLED',
      handover_rejected: 'HANDOVER REJECTED'
    };
    return map[status] || status.replace(/_/g, ' ').toUpperCase();
  }

  function flowText(s) {
    const status = cleanStatus(s);
    const map = {
      handover_pending: 'Handover approval pending',
      pending_handover: 'Handover approval pending',
      admin_pending: 'Admin approval pending',
      pending_admin: 'Admin approval pending',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      handover_rejected: 'Handover rejected'
    };
    return map[status] || statusText(status);
  }

  function daysCount() {
    const a = fromDateInput.value;
    const b = toDateInput.value;

    if (!a || !b) return 0;

    const d1 = new Date(a + 'T00:00:00');
    const d2 = new Date(b + 'T00:00:00');

    if (d2 < d1) return 0;

    return Math.floor((d2 - d1) / 86400000) + 1;
  }

  function updateDays() {
    const d = daysCount();
    daysCountSpan.textContent = '📆 Total days: ' + d + ' ' + (d === 1 ? 'day' : 'days');
    return d;
  }

  function priority() {
    const checked = document.querySelector('input[name="priority"]:checked');
    return checked ? checked.value : 'Normal';
  }

  function setEnabled(ok) {
    state.featureEnabled = !!ok;
    featureNotice.style.display = ok ? 'none' : 'block';

    Array.from(leaveForm.querySelectorAll('input,select,textarea,button')).forEach(el => {
      el.disabled = !ok;
    });

    submitBtn.disabled = !ok;
  }

  async function rpc(name, args) {
    const res = await sb.rpc(name, args || {});
    if (res.error) {
      console.error(name + ' error:', res.error);
      throw res.error;
    }
    return res.data;
  }

  function normalizeScreenData(raw) {
    const d = Array.isArray(raw) ? raw[0] : raw;
    if (!d) throw new Error('No data returned from server.');

    state.employee = d.employee || d.emp || null;
    state.organization = d.organization || d.org || null;
    state.employees = d.handover_employees || d.employees || [];
    state.leaves = (d.leaves || d.my_leaves || []).slice(0, 5);
    state.handovers = (d.handovers || d.handover_requests || []).slice(0, 5);

    const features = d.features || [];
    const enabledFromFlag =
      d.leave_enabled === true ||
      d.feature_enabled === true ||
      d.is_leave_enabled === true;

    const leaveFeature = features.find(f => {
      const k = String(f.feature_key || f.key || '').toLowerCase();
      return k === 'leave_management' || k === 'leave';
    });

    const enabledFromFeature = leaveFeature
      ? (leaveFeature.is_enabled === true || leaveFeature.enabled === true || leaveFeature.active === true)
      : false;

    setEnabled(enabledFromFlag || enabledFromFeature || features.length === 0);

    if (!state.employee || !state.organization) {
      throw new Error('Employee / organization context nahi mila. URL me org_code aur emp_code check karein.');
    }
  }

  function getNameFromEmployeeObj(obj) {
    if (!obj) return '';
    return pickValue(
      obj.full_name,
      obj.employee_name,
      obj.name,
      obj.emp_name,
      obj.fullName
    );
  }

  function getCodeFromEmployeeObj(obj) {
    if (!obj) return '';
    return pickValue(
      obj.emp_code,
      obj.employee_code,
      obj.empCode
    );
  }

  async function enrichHandoverNames() {
    const ids = [];

    (state.handovers || []).forEach(h => {
      if (h.employee_id) ids.push(h.employee_id);
      if (h.handover_employee_id) ids.push(h.handover_employee_id);
    });

    const uniqueIds = [...new Set(ids.filter(Boolean))];
    const employeeMap = {};

    if (uniqueIds.length) {
      const { data, error } = await sb
        .from('employees')
        .select('id,full_name,emp_code,department,designation')
        .in('id', uniqueIds);

      if (error) {
        console.warn('Handover employee name fetch failed:', error.message);
      } else {
        (data || []).forEach(e => {
          employeeMap[String(e.id)] = e;
        });
      }
    }

    state.handovers = (state.handovers || []).map(h => {
      const requester = employeeMap[String(h.employee_id)] || {};
      const handover = employeeMap[String(h.handover_employee_id)] || {};

      const requesterName = pickValue(
        h.employee_full_name,
        h.full_name,
        h.employee_name,
        h.requester_name,
        h.emp_name,
        h.employee?.full_name,
        h.employee?.employee_name,
        getNameFromEmployeeObj(requester),
        h.created_by_name,
        h.updated_by_name,
        'Unknown Employee'
      );

      const requesterCode = pickValue(
        h.employee_code,
        h.emp_code,
        h.requester_emp_code,
        h.employee_emp_code,
        h.employee?.emp_code,
        getCodeFromEmployeeObj(requester),
        '-'
      );

      const handoverName = pickValue(
        h.handover_full_name,
        h.handover_name,
        h.handover_employee_name,
        h.handover?.full_name,
        h.handover?.employee_name,
        getNameFromEmployeeObj(handover),
        '-'
      );

      const handoverCode = pickValue(
        h.handover_code,
        h.handover_emp_code,
        h.handover_employee_code,
        h.handover?.emp_code,
        getCodeFromEmployeeObj(handover),
        '-'
      );

      return {
        ...h,
        employee_full_name: requesterName,
        employee_name: requesterName,
        full_name: requesterName,
        employee_code: requesterCode,
        emp_code: requesterCode,
        handover_full_name: handoverName,
        handover_name: handoverName,
        handover_code: handoverCode,
        handover_emp_code: handoverCode
      };
    });
  }

  async function loadData() {
    initDateLimits();

    historyContainer.innerHTML = '<div class="loading">Loading leave history...</div>';
    handoverList.innerHTML = '<div class="loading">Loading handover requests...</div>';

    if (!state.orgCode || !state.empCode) {
      empHeader.innerHTML = '<strong>Error</strong> <span>|</span> Login/session missing';
      setEnabled(false);
      historyContainer.innerHTML = '<div class="loading">org_code / emp_code missing hai.</div>';
      handoverList.innerHTML = '<div class="loading">No handover approval request.</div>';
      toast('Login/session missing: org_code aur emp_code required hai.', true);
      return;
    }

    try {
      const screen = await rpc('app_leave_screen_data', {
        p_org_code: state.orgCode || null,
        p_emp_code: state.empCode || null,
        p_email: null,
        p_mobile: null,
        p_limit: 5
      });

      normalizeScreenData(screen);
      await enrichHandoverNames();

      if (state.organization && state.organization.org_code) {
        localStorage.setItem('org_code', state.organization.org_code);
      }

      if (state.employee && state.employee.emp_code) {
        localStorage.setItem('emp_code', state.employee.emp_code);
      }

      empHeader.innerHTML =
        '<strong>' + esc(state.employee.full_name || state.employee.name || '-') + '</strong>' +
        '<span>|</span>ID: ' + esc(state.employee.emp_code || '-') +
        '<span>|</span>' + esc(state.organization.org_code || state.orgCode || '-');

      renderHistory();
      renderHandovers();
    } catch (err) {
      console.error('loadData final error:', err);
      empHeader.innerHTML = '<strong>Error</strong> <span>|</span> Employee not found / RPC missing';
      setEnabled(false);
      historyContainer.innerHTML = '<div class="loading">' + esc(friendlyError(err)) + '</div>';
      handoverList.innerHTML = '<div class="loading">No handover approval request.</div>';
      toast(friendlyError(err), true);
    }
  }

  function renderSuggestions() {
    const q = searchInput.value.trim().toLowerCase();

    if (!q) {
      suggestionsDiv.innerHTML = '';
      return;
    }

    const rows = state.employees.filter(function (e) {
      return String(e.full_name || '').toLowerCase().includes(q) ||
        String(e.emp_code || '').toLowerCase().includes(q) ||
        String(e.department || '').toLowerCase().includes(q);
    }).slice(0, 20);

    suggestionsDiv.innerHTML = rows.map(function (e) {
      return '<div class="suggestion-item" data-id="' + attr(e.id) + '">' +
        '👤 <b>' + esc(e.full_name || '-') + '</b> (' + esc(e.emp_code || '-') + ') — ' + esc(e.department || '-') +
        '</div>';
    }).join('');
  }

  function selectHandover(id) {
    const emp = state.employees.find(function (e) {
      return String(e.id) === String(id);
    });

    if (!emp) return;

    state.selectedHandover = emp;
    searchInput.value = (emp.full_name || '-') + ' (' + (emp.emp_code || '-') + ')';
    suggestionsDiv.innerHTML = '';

    selectedHandoverDiv.classList.remove('hidden');
    selectedHandoverDiv.innerHTML =
      '<strong>✅ Handover Selected:</strong> ' +
      esc(emp.full_name || '-') + ' (' + esc(emp.emp_code || '-') + ')<br>' +
      '<span>Department: ' + esc(emp.department || '-') + ' | ' + esc(emp.designation || '-') + '</span>';
  }

  async function uploadDoc() {
    const file = docUploadInput.files && docUploadInput.files[0];
    if (!file) return { url: null, name: null };

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = state.orgCode + '/' + state.empCode + '/' + Date.now() + '_' + safe;

    const up = await sb.storage.from('leave-documents').upload(path, file, { upsert: false });

    if (up.error) {
      console.warn('Document upload warning:', up.error);
      toast('Document upload nahi hua, leave submit continue hoga.', true);
      return { url: null, name: file.name };
    }

    const pub = sb.storage.from('leave-documents').getPublicUrl(path);

    return {
      url: pub.data && pub.data.publicUrl ? pub.data.publicUrl : null,
      name: file.name
    };
  }

  async function submitLeave(e) {
    e.preventDefault();

    const total = updateDays();
    const reason = reasonTextarea.value.trim();
    const today = todayYmd();

    if (!state.featureEnabled) return toast('Leave feature enabled nahi hai.', true);
    if (!fromDateInput.value || !toDateInput.value || total <= 0) return toast('Valid date range select karein.', true);

    if (fromDateInput.value < today || toDateInput.value < today) {
      return toast('Previous date par leave apply nahi kar sakte.', true);
    }

    if (toDateInput.value < fromDateInput.value) {
      return toast('To date, From date se chhoti nahi ho sakti.', true);
    }

    if (!reason) return toast('Reason required hai.', true);
    if (!state.selectedHandover) return toast('Handover employee select karein.', true);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const uploaded = await uploadDoc();

      const res = await sb.rpc('app_apply_leave', {
        p_org_code: (state.organization && state.organization.org_code) || state.orgCode,
        p_emp_code: (state.employee && state.employee.emp_code) || state.empCode,
        p_leave_type: leaveTypeSelect.value,
        p_from_date: fromDateInput.value,
        p_to_date: toDateInput.value,
        p_reason: reason,
        p_priority: priority(),
        p_handover_emp_code: state.selectedHandover.emp_code,
        p_attachment_url: uploaded.url,
        p_attachment_name: uploaded.name
      });

      if (res.error) throw res.error;

      toast('✅ Leave request handover approval ke liye chali gayi');

      leaveForm.reset();
      state.selectedHandover = null;
      selectedHandoverDiv.classList.add('hidden');
      selectedHandoverDiv.innerHTML = '';
      suggestionsDiv.innerHTML = '';

      initDateLimits();
      updateDays();
      await loadData();
    } catch (error) {
      console.error('app_apply_leave error:', error);
      toast(friendlyError(error), true);
    } finally {
      submitBtn.textContent = '📨 Apply Leave & Send to Handover';
      submitBtn.disabled = !state.featureEnabled;
    }
  }

  async function cancelLeave(id) {
    if (!confirm('Pending leave request cancel karna hai?')) return;

    try {
      const res = await sb.rpc('app_cancel_leave', {
        p_org_code: (state.organization && state.organization.org_code) || state.orgCode,
        p_emp_code: (state.employee && state.employee.emp_code) || state.empCode,
        p_leave_id: id
      });

      if (res.error) throw res.error;

      toast('Leave cancelled');
      await loadData();
    } catch (error) {
      console.error('app_cancel_leave error:', error);
      toast(friendlyError(error) || 'Cancel failed', true);
    }
  }

  async function handoverDecision(id, decision) {
    const note = decision === 'accepted'
      ? 'Accepted by handover staff'
      : (prompt('Reject reason likhiye:') || 'Rejected by handover staff');

    try {
      const res = await sb.rpc('app_update_handover_leave_status', {
        p_org_code: (state.organization && state.organization.org_code) || state.orgCode,
        p_emp_code: (state.employee && state.employee.emp_code) || state.empCode,
        p_leave_id: id,
        p_accept: decision === 'accepted',
        p_handover_note: note
      });

      if (res.error) throw res.error;

      toast(decision === 'accepted' ? 'Handover accepted, ab admin approval pending hai' : 'Handover rejected');
      await loadData();
    } catch (error) {
      console.error('app_update_handover_leave_status error:', error);
      toast(friendlyError(error) || 'Handover update failed', true);
    }
  }

  function buildPdfHtml(l) {
    const company = esc(l.company_name || l.org_name || (state.organization && (state.organization.org_name || state.organization.org_code)) || 'Company');
    const empName = esc(l.employee_full_name || l.full_name || l.employee_name || (state.employee && state.employee.full_name) || '-');
    const empCode = esc(l.employee_code || l.emp_code || (state.employee && state.employee.emp_code) || '-');
    const handover = esc(l.handover_full_name || l.handover_name || 'N/A') +
      ((l.handover_code || l.handover_emp_code) ? ' (' + esc(l.handover_code || l.handover_emp_code) + ')' : '');
    const admin = esc(l.admin_signature_name || l.admin_full_name || l.approved_by_name || l.admin_name || 'Admin');
    const approvedDate = l.approved_at ? new Date(l.approved_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

    return '<!doctype html><html><head><meta charset="UTF-8"><title>Leave Approval PDF</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:34px;color:#111}.box{border:2px solid #111;padding:26px;max-width:780px;margin:auto}.head{text-align:center;border-bottom:1px solid #999;padding-bottom:16px;margin-bottom:22px}.head h1{margin:0;font-size:25px}.row{display:flex;border-bottom:1px solid #ddd;padding:11px 0}.lab{width:210px;font-weight:bold}.val{flex:1}.sign{margin-top:70px;text-align:right}.sign .line{display:inline-block;border-top:1px solid #111;padding-top:8px;min-width:240px}.digital{font-family:cursive;font-size:28px;color:#123b64}.ok{margin:18px 0;padding:10px;background:#ecfdf5;border:1px solid #86efac;color:#166534;font-weight:bold}button{padding:10px 16px;border:0;border-radius:999px;background:#123b64;color:#fff;font-weight:bold;margin-bottom:18px;cursor:pointer}@media print{button{display:none}body{padding:0}.box{border:0}}</style>' +
      '</head><body><button id="printBtn">Download / Save as PDF</button><div class="box">' +
      '<div class="head"><h1>' + company + '</h1><h2>Leave Approval Certificate</h2></div>' +
      '<div class="ok">This leave request is approved by handover staff and admin.</div>' +
      '<div class="row"><div class="lab">Employee Name</div><div class="val">' + empName + '</div></div>' +
      '<div class="row"><div class="lab">Employee ID</div><div class="val">' + empCode + '</div></div>' +
      '<div class="row"><div class="lab">Leave Type</div><div class="val">' + esc(l.leave_type) + '</div></div>' +
      '<div class="row"><div class="lab">Leave From</div><div class="val">' + formatDate(l.from_date) + '</div></div>' +
      '<div class="row"><div class="lab">Leave To</div><div class="val">' + formatDate(l.to_date) + '</div></div>' +
      '<div class="row"><div class="lab">Total Days</div><div class="val">' + Number(l.total_days || 0) + '</div></div>' +
      '<div class="row"><div class="lab">Reason</div><div class="val">' + esc(l.reason || l.employee_note || '-') + '</div></div>' +
      '<div class="row"><div class="lab">Handover Taken By</div><div class="val">' + handover + '</div></div>' +
      '<div class="row"><div class="lab">Approved Date</div><div class="val">' + approvedDate + '</div></div>' +
      '<div class="sign"><div class="digital">' + admin + '</div><div class="line">Admin Digital Signature</div></div>' +
      '</div></body></html>';
  }

  function downloadPdf(l) {
    const w = window.open('', '_blank');

    if (!w) return toast('Popup blocked. Browser popup allow karein.', true);

    w.document.open();
    w.document.write(buildPdfHtml(l));
    w.document.close();

    setTimeout(function () {
      try {
        const btn = w.document.getElementById('printBtn');
        if (btn) btn.onclick = function () { w.print(); };
        w.focus();
        w.print();
      } catch (err) {
        console.warn('PDF print warning:', err);
      }
    }, 500);
  }

  function renderHandovers() {
    if (!state.handovers.length) {
      handoverList.innerHTML = '<div class="loading">✨ No handover approval request.</div>';
      return;
    }

    handoverList.innerHTML = state.handovers.map(function (l) {
      const empName = pickValue(
        l.employee_full_name,
        l.full_name,
        l.employee_name,
        l.requester_name,
        l.created_by_name,
        'Unknown Employee'
      );

      const empCode = pickValue(
        l.employee_code,
        l.emp_code,
        l.requester_emp_code,
        '-'
      );

      return '<div class="history-item">' +
        '<div class="history-top"><div><strong>👤 ' + esc(empName) + '</strong> (' + esc(empCode) + ')</div>' +
        '<span class="status ' + attr(cleanStatus(l.status)) + '">' + statusText(l.status) + '</span></div>' +
        '<div>📌 ' + esc(l.leave_type) + ' | ' + formatDate(l.from_date) + ' → ' + formatDate(l.to_date) + ' | ' + Number(l.total_days || 0) + ' day(s)</div>' +
        '<div>📝 ' + esc(l.reason || l.employee_note || '-') + '</div>' +
        '<button class="ok-btn" data-handover-ok="' + attr(l.id) + '">Accept Handover</button>' +
        '<button class="reject-btn" data-handover-reject="' + attr(l.id) + '">Reject</button>' +
        '</div>';
    }).join('');
  }

  function renderHistory() {
    if (!state.leaves.length) {
      historyContainer.innerHTML = '<div class="loading">✨ No leave request found.</div>';
      return;
    }

    historyContainer.innerHTML = state.leaves.map(function (l) {
      const status = cleanStatus(l.status);
      const canCancel = ['pending', 'handover_pending', 'pending_handover', 'admin_pending', 'pending_admin'].includes(status);
      const canPdf = status === 'approved' && (l.approval_pdf_ready === true || l.approval_pdf_ready === 'true' || l.approval_pdf_ready === undefined);

      let html = '<div class="history-item">' +
        '<div class="history-top"><div><strong>📌 ' + esc(l.leave_type) + '</strong> | ' + formatDate(l.from_date) + ' → ' + formatDate(l.to_date) + '</div>' +
        '<span class="status ' + attr(status) + '">' + statusText(status) + '</span></div>' +
        '<div>📆 ' + Number(l.total_days || 0) + ' day(s) &nbsp; ⚡ ' + esc(l.priority || 'Normal') + '</div>' +
        '<div>📝 ' + esc(l.reason || l.employee_note || '-') + '</div>' +
        '<div>🤝 Handover: ' + esc(l.handover_full_name || l.handover_name || 'N/A') +
        ((l.handover_code || l.handover_emp_code) ? ' (' + esc(l.handover_code || l.handover_emp_code) + ')' : '') + '</div>' +
        '<div class="small-muted">Flow: ' + flowText(status) + '</div>';

      if (l.attachment_url) {
        html += '<div>📎 <a href="' + attr(l.attachment_url) + '" target="_blank">' + esc(l.attachment_name || 'Open document') + '</a></div>';
      }

      if (l.admin_note) {
        html += '<div>🧾 Admin Note: ' + esc(l.admin_note) + '</div>';
      }

      html += '<div class="small-muted">Applied: ' + (l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : '-') + '</div>';

      if (canPdf) {
        html += '<button class="pdf-btn" data-pdf="' + attr(l.id) + '">⬇️ Download Approved Leave PDF</button>';
      }

      if (canCancel) {
        html += '<button class="cancel-btn" data-cancel="' + attr(l.id) + '">Cancel Request</button>';
      }

      html += '</div>';
      return html;
    }).join('');
  }

  fromDateInput.addEventListener('change', function () {
    const today = todayYmd();

    if (fromDateInput.value && fromDateInput.value < today) {
      toast('Previous date par leave apply nahi kar sakte.', true);
      fromDateInput.value = '';
      toDateInput.min = today;
      updateDays();
      return;
    }

    if (fromDateInput.value) {
      toDateInput.min = fromDateInput.value;

      if (toDateInput.value && toDateInput.value < fromDateInput.value) {
        toDateInput.value = fromDateInput.value;
      }
    } else {
      toDateInput.min = today;
    }

    updateDays();
  });

  toDateInput.addEventListener('change', function () {
    const today = todayYmd();

    if (toDateInput.value && toDateInput.value < today) {
      toast('Previous date par leave apply nahi kar sakte.', true);
      toDateInput.value = '';
      updateDays();
      return;
    }

    if (fromDateInput.value && toDateInput.value && toDateInput.value < fromDateInput.value) {
      toast('To date, From date se chhoti nahi ho sakti.', true);
      toDateInput.value = fromDateInput.value;
    }

    updateDays();
  });

  searchInput.addEventListener('input', renderSuggestions);
  leaveForm.addEventListener('submit', submitLeave);

  suggestionsDiv.addEventListener('click', function (e) {
    const item = e.target.closest('.suggestion-item');
    if (item) selectHandover(item.dataset.id);
  });

  historyContainer.addEventListener('click', function (e) {
    const c = e.target.closest('[data-cancel]');
    if (c) return cancelLeave(c.dataset.cancel);

    const p = e.target.closest('[data-pdf]');
    if (p) {
      const row = state.leaves.find(function (x) {
        return String(x.id) === String(p.dataset.pdf);
      });

      if (row) downloadPdf(row);
    }
  });

  handoverList.addEventListener('click', function (e) {
    const ok = e.target.closest('[data-handover-ok]');
    if (ok) return handoverDecision(ok.dataset.handoverOk, 'accepted');

    const rej = e.target.closest('[data-handover-reject]');
    if (rej) return handoverDecision(rej.dataset.handoverReject, 'rejected');
  });

  backArrow.addEventListener('click', function () {
    if (history.length > 1) history.back();
    else location.href = state.returnPage || 'emp.html';
  });

  initDateLimits();
  updateDays();
  loadData();

})();