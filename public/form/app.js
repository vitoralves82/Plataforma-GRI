// --- CONFIG ---
const ENDPOINT = 'https://pkmgknsijzkdmzsgeqrb.supabase.co/functions/v1/submit_response';
// Cole aqui a MESMA ANON KEY que você usou no curl:
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbWdrbnNpanprZG16c2dlcXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTM1NDYsImV4cCI6MjA3Mjc2OTU0Nn0.7k5bAH-6LQICcmsdec911FTz121g0XMDdQbRkM0Ua64'; // <-- substitua

// --- TOKEN DA URL (?t=seu_token) ---
const params = new URLSearchParams(location.search);
const token = params.get('t'); // ex.: ?t=navegador001

const form = document.querySelector('#f');
const out  = document.querySelector('#out');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!token) {
    out.textContent = 'Erro: URL sem ?t=TOKEN. Abra o link com ?t=seu_token.';
    return;
  }

  const fd = new FormData(form);
  fd.set('token', token); // O Edge exige esse campo

  out.textContent = 'Enviando...';

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ANON}` }, // não defina Content-Type
      body: fd
    });

    const text = await res.text(); // pode vir texto de erro ou JSON
    out.textContent = `Status ${res.status}: ${text}`;
  } catch (err) {
    out.textContent = `Erro de rede: ${err}`;
  }
});
