/* Navalha — comportamento das telas (jQuery). Tudo aqui é só visual; as ações reais entram na etapa de estrutura. */
$(function () {
  const C = { ink: '#111a22', red: '#c62839', blue: '#1d4e89', brass: '#a8843f', grid: '#e3e7e5', muted: '#667480' };
  const palette = [C.blue, C.red, C.ink, C.brass];
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const toast = (icon, title) => Swal.fire({
    toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2600, timerProgressBar: true
  });
  const btnClasses = { confirmButton: 'btn btn-pole', cancelButton: 'btn btn-line ms-2' };
  const swalBase = { buttonsStyling: false, customClass: btnClasses, reverseButtons: true };

  /* ---------- Choices.js ---------- */
  $('select[data-choices]').each(function () {
    new Choices(this, { searchEnabled: false, itemSelectText: '', shouldSort: false });
  });

  /* ---------- Gráficos: <canvas data-config="{{json chart}}"> ---------- */
  if (window.Chart) {
    Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
    Chart.defaults.color = C.muted;

    $('canvas[data-config]').each(function () {
      const cfg = $(this).data('config');
      const isRound = cfg.type === 'doughnut';
      const datasets = cfg.datasets.map((d, i) => {
        if (isRound) return { ...d, backgroundColor: palette, borderWidth: 2, borderColor: '#fff' };
        if (cfg.type === 'line') return { ...d, borderColor: palette[i], backgroundColor: palette[i], tension: .3, pointRadius: 3, borderWidth: 2.5 };
        return { ...d, backgroundColor: palette[i % palette.length], borderRadius: 5, maxBarThickness: 38 };
      });
      new Chart(this, {
        type: cfg.type,
        data: { labels: cfg.labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: isRound ? '68%' : undefined,
          plugins: {
            legend: { display: isRound || datasets.length > 1, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: { callbacks: { label: (c) => ` ${c.label || c.dataset.label}: ${cfg.money ? brl(c.parsed.y ?? c.parsed) : (c.parsed.y ?? c.parsed)}` } }
          },
          scales: isRound ? {} : {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: (v) => (cfg.money ? brl(v) : v) } }
          }
        }
      });
    });
  }

  /* ---------- Assinantes: busca + filtro por status ---------- */
  let statusFilter = 'all';
  const applyFilters = () => {
    const q = ($('#subSearch').val() || '').toLowerCase();
    $('#subTable tbody tr').each(function () {
      const okName = $(this).data('name').toLowerCase().includes(q);
      const okStatus = statusFilter === 'all' || $(this).data('status') === statusFilter;
      $(this).toggle(okName && okStatus);
    });
  };
  $('#subSearch').on('input', applyFilters);
  $('.chip[data-filter]').on('click', function () {
    $('.chip[data-filter]').removeClass('is-on');
    $(this).addClass('is-on');
    statusFilter = $(this).data('filter');
    applyFilters();
  });

  /* ---------- Agenda: seleção do dia ---------- */
  $('.week button').on('click', function () {
    $('.week button').removeClass('is-on');
    $(this).addClass('is-on');
  });

  /* ---------- Novo agendamento (dono) ---------- */
  $(document).on('click', '.js-new-appointment', function () {
    const time = $(this).data('time') || '';
    Swal.fire({
      ...swalBase,
      title: 'Novo agendamento',
      html: `<div class="swal-form">
        <div><label class="form-label">Cliente</label><input id="apClient" class="form-control" placeholder="Nome ou telefone"></div>
        <div><label class="form-label">Serviço</label>
          <select id="apService" class="form-select"><option>Corte</option><option>Barba</option><option>Corte + barba</option></select></div>
        <div><label class="form-label">Horário</label><input id="apTime" type="time" class="form-control" value="${time}"></div>
      </div>`,
      showCancelButton: true, confirmButtonText: 'Agendar', cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const client = $('#apClient').val().trim();
        if (!client) { Swal.showValidationMessage('Informe o nome do cliente'); return false; }
        return { client };
      }
    }).then((r) => r.isConfirmed && toast('success', `Agendado para ${r.value.client}`));
  });

  /* ---------- Novo plano (dono) ---------- */
  $(document).on('click', '.js-new-plan', function () {
    Swal.fire({
      ...swalBase,
      title: 'Novo plano',
      html: `<div class="swal-form">
        <div><label class="form-label">Nome do plano</label><input id="plName" class="form-control" placeholder="Ex.: Clube corte + barba"></div>
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Tipo</label>
            <select id="plType" class="form-select"><option value="monthly">Mensal (recorrente)</option><option value="single">Avulso (pagamento único)</option></select></div>
          <div class="col-6"><label class="form-label">Preço (R$)</label><input id="plPrice" type="number" step="0.01" min="0" class="form-control"></div>
          <div class="col-6"><label class="form-label">Cortes inclusos</label><input id="plCuts" type="number" min="1" value="4" class="form-control"></div>
          <div class="col-6"><label class="form-label">Validade (dias)</label><input id="plDays" type="number" min="1" value="30" class="form-control"></div>
        </div>
      </div>`,
      showCancelButton: true, confirmButtonText: 'Criar plano', cancelButtonText: 'Cancelar',
      preConfirm: () => {
        if (!$('#plName').val().trim() || !$('#plPrice').val()) { Swal.showValidationMessage('Preencha nome e preço'); return false; }
        return { name: $('#plName').val().trim() };
      }
    }).then((r) => r.isConfirmed && toast('success', `Plano "${r.value.name}" criado`));
  });

  /* ---------- Pagamento (assinar / comprar) ---------- */
  $(document).on('click', '.js-pay', function () {
    const plan = $(this).data('plan'); const price = Number($(this).data('price'));
    Swal.fire({
      ...swalBase,
      title: `Assinar ${plan}`,
      html: `<div class="swal-form">
        <p class="mb-1 text-muted">Total: <strong class="text-body">${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
        <div class="choices-list" style="grid-template-columns:1fr 1fr">
          <div class="choice"><input type="radio" name="pm" id="pmPix" value="pix" checked><label for="pmPix"><strong><i class="bi bi-qr-code"></i> Pix</strong><small>Aprovação na hora</small></label></div>
          <div class="choice"><input type="radio" name="pm" id="pmCard" value="card"><label for="pmCard"><strong><i class="bi bi-credit-card"></i> Cartão</strong><small>Renova sozinho</small></label></div>
        </div>
      </div>`,
      showCancelButton: true, confirmButtonText: 'Continuar para o pagamento', cancelButtonText: 'Voltar',
      preConfirm: () => $('input[name=pm]:checked').val()
    }).then((r) => {
      if (!r.isConfirmed) return;
      Swal.fire({ title: 'Abrindo pagamento…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      setTimeout(() => Swal.fire({ ...swalBase, icon: 'success', title: 'Pagamento simulado', text: 'Aqui entra o checkout do gateway na etapa de estrutura.', confirmButtonText: 'Ok' }), 1100);
    });
  });

  $(document).on('click', '.js-change-card', () => toast('info', 'Troca de cartão entra com o gateway'));
  $(document).on('click', '.js-export', () => toast('info', 'Exportação em CSV entra na etapa de estrutura'));

  $(document).on('click', '.js-cancel-sub', function () {
    Swal.fire({
      ...swalBase, icon: 'warning', title: 'Cancelar assinatura?',
      text: 'Você mantém os cortes restantes até o fim do período já pago.',
      showCancelButton: true, confirmButtonText: 'Cancelar assinatura', cancelButtonText: 'Manter plano'
    }).then((r) => r.isConfirmed && toast('success', 'Cancelamento agendado para 27/10'));
  });

  $(document).on('click', '.js-remind', function () {
    toast('success', `Lembrete enviado para ${$(this).data('name')}`);
  });

  /* ---------- Fluxo de agendamento do assinante ---------- */
  const $flow = $('#bookFlow');
  if ($flow.length) {
    const state = { service: null, barber: null, day: null, time: null };
    let step = 1;
    const total = 4;

    const render = () => {
      $('.step-panel').removeClass('is-on').filter(`[data-step=${step}]`).addClass('is-on');
      $('.steps li').each(function (i) {
        $(this).toggleClass('is-on', i + 1 === step).toggleClass('is-done', i + 1 < step);
      });
      $('#btnPrev').toggle(step > 1);
      $('#btnNext').toggle(step < total);
      $('#btnConfirm').toggle(step === total);
      $('#sumService').text(state.service || '—');
      $('#sumBarber').text(state.barber || '—');
      $('#sumWhen').text(state.day && state.time ? `${state.day} às ${state.time}` : '—');
    };

    const valid = () => {
      if (step === 1) return !!state.service;
      if (step === 2) return !!state.barber;
      if (step === 3) return !!(state.day && state.time);
      return true;
    };

    $('input[name=service]').on('change', function () { state.service = $(this).data('label'); });
    $('input[name=barber]').on('change', function () { state.barber = $(this).data('label'); });
    state.day = $('.js-day.is-on').data('label') || null;

    $('.js-day').on('click', function () {
      $('.js-day').removeClass('is-on'); $(this).addClass('is-on');
      state.day = $(this).data('label'); state.time = null;
      $('.day-slots').addClass('d-none').filter(`[data-day=${$(this).data('key')}]`).removeClass('d-none');
      $('.slot-btn').removeClass('is-on');
    });
    $('.slot-btn').on('click', function () {
      $('.slot-btn').removeClass('is-on'); $(this).addClass('is-on');
      state.time = $(this).text().trim();
    });

    $('#btnNext').on('click', () => {
      if (!valid()) return toast('warning', 'Escolha uma opção para continuar');
      step = Math.min(step + 1, total); render();
    });
    $('#btnPrev').on('click', () => { step = Math.max(step - 1, 1); render(); });
    $('#btnConfirm').on('click', () => {
      Swal.fire({ ...swalBase, icon: 'success', title: 'Corte agendado', text: `${state.service} com ${state.barber}, ${state.day} às ${state.time}.`, confirmButtonText: 'Ok' });
    });
    render();
  }
});
