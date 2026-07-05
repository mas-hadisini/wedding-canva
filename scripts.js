lucide.createIcons();

// 1. Inisialisasi Kredensial Supabase (Nilai process.env akan diganti otomatis oleh Netlify saat deploy)
const supabaseUrl = 'process.env.SUPABASE_URL';
const supabaseKey = 'process.env.SUPABASE_KEY';
const supabase = supabaseJs.createClient(supabaseUrl, supabaseKey);

const MAX_GUESTS = 4;
let guestCount = 1;
let currentData = [];
let isSending = false;

const form = document.getElementById('rsvp-form');
const nameInput = document.getElementById('guest-name');
const commentInput = document.getElementById('guest-comment');
const guestBlock = document.getElementById('guest-count-block');
const guestValueEl = document.getElementById('guest-count-value');
const errorEl = document.getElementById('form-error');
const successEl = document.getElementById('form-success');
const submitBtn = document.getElementById('submit-btn');
const submitDefault = document.querySelector('[data-template-id="submit-button"]');
const submitSending = document.querySelector('[data-template-id="submit-sending"]');

// Fungsi baru untuk mengambil data ucapan terbaru dari Supabase
async function muatUcapanTamu() {
    const { data: rsvps, error } = await supabase
        .from('rsvps')
        .select('*')
        .order('created_at', { ascending: false }); // Urutkan dari ucapan terbaru

    if (error) {
        console.error('Gagal memuat ucapan dari Supabase:', error);
        return;
    }

  // Format data dari Supabase agar cocok dengan struktur UI bawaan template Canva
    const formattedData = rsvps.map(record => ({
        __backendId: record.id,
        guest_name: record.name,
        attendance: record.attendance,
        comment: record.comment
    }));

  // Panggil dataHandler bawaan untuk merender kotak ucapan ke layar
    if (typeof dataHandler === 'function' || (dataHandler && typeof dataHandler.onDataChanged === 'function')) {
        dataHandler.onDataChanged(formattedData);
    }
}

// Attendance toggle -> guest count visibility
document.querySelectorAll('input[name="attendance"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === 'hadir' && radio.checked) {
            guestBlock.classList.remove('hidden');
        } else {
            guestBlock.classList.add('hidden');
        }
    });
});

// Guest count stepper
function updateGuestDisplay() { guestValueEl.textContent = String(guestCount); }
document.getElementById('guest-minus').addEventListener('click', () => {
    if (guestCount > 1) { guestCount--; updateGuestDisplay(); }
});
document.getElementById('guest-plus').addEventListener('click', () => {
    if (guestCount < MAX_GUESTS) { guestCount++; updateGuestDisplay(); }
});

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
}

// Handle Form Submit ( RSVP ) menggunakan Supabase
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isSending) return;

    const name = nameInput.value ? nameInput.value.trim() : '';
    const comment = commentInput.value ? commentInput.value.trim() : '';
    const attendanceRadio = form.querySelector('input[name="attendance"]:checked');
    const attendance = attendanceRadio ? attendanceRadio.value : '';

    if (!name) {
        showError('Silakan masukkan nama Anda.');
        return;
    }
    if (!attendance) {
        showError('Silakan pilih status kehadiran Anda.');
        return;
    }

    const finalGuestCount = attendance === 'hadir' ? guestCount : 0;

    isSending = true;
    submitDefault.classList.add('hidden');
    submitSending.classList.remove('hidden');

  // Proses Kirim Data ke Supabase
    supabase.from('rsvps')
    .insert([
        {
            name: name,
            attendance: attendance,
            guest_count: finalGuestCount,
            comment: comment
        }
    ])
    .then(({ error }) => {
        if (error) throw error;

      // Skenario Berhasil
        nameInput.value = '';
        commentInput.value = '';
        successEl.classList.remove('hidden');
        setTimeout(() => successEl.classList.add('hidden'), 5000);

      // Refresh list ucapan di bawahnya secara real-time
        muatUcapanTamu();
    })
    .catch(err => {
      // Skenario Gagal
        showError(err.message || 'Gagal mengirim konfirmasi.');
    })
    .finally(() => {
        isSending = false;
        submitDefault.classList.remove('hidden');
        submitSending.classList.add('hidden');
    });
});

function createWishCard(record) {
    const template = document.getElementById('wish-card-template');
    const el = template.content.cloneNode(true).firstElementChild;
    el.dataset.backendId = record.__backendId;
    el.querySelector('[data-template-id="wish-card-name"]').textContent = record.guest_name || '';
    const c = el.querySelector('[data-template-id="wish-card-comment"]');
    c.textContent = record.comment && record.comment.trim() ? record.comment : '—';
return el;
}

const dataHandler = {
    onDataChanged(data) {
    currentData = data.slice().sort((a, b) => {
        const ta = a.created_at || '', tb = b.created_at || '';
        return tb.localeCompare(ta);
    });

    const list = document.getElementById('wishes-list');
    const emptyEl = document.querySelector('[data-template-id="wishes-empty"]');

    if (emptyEl) {
        emptyEl.style.display = currentData.length === 0 ? '' : 'none';
    }

    const existing = new Map([...list.children].map(el => [el.dataset.backendId, el]));

    currentData.forEach(record => {
        let el = existing.get(record.__backendId);
        if (el) {
        el.querySelector('[data-template-id="wish-card-name"]').textContent = record.guest_name || '';
        const c = el.querySelector('[data-template-id="wish-card-comment"]');
        c.textContent = record.comment && record.comment.trim() ? record.comment : '—';
        existing.delete(record.__backendId);
        list.appendChild(el);
        } else {
        list.appendChild(createWishCard(record));
        }
    });

    existing.forEach(el => el.remove());
    lucide.createIcons();
    }
};

// Jalankan fungsi muat ucapan pertama kali saat halaman selesai dibuka
document.addEventListener('DOMContentLoaded', () => {
    muatUcapanTamu();
});