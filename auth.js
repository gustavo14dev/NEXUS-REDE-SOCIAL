// Estado da aplicação
let currentUser = null;

// Elementos do DOM
const loadingScreen = document.getElementById('loadingScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', async () => {
    try {
        setupEventListeners();
        if (supabase) {
            await checkAuthStatus();
        }
    } catch (e) {
        console.error('Erro na inicialização:', e);
    } finally {
        hideLoadingScreen();
    }
});

// Configurar event listeners
function setupEventListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

// Verificar status de autenticação
async function checkAuthStatus() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (session?.user && !error) {
            currentUser = session.user;
            // Se já está logado e está na página de login/cadastro, redireciona para o feed
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('cadastro.html')) {
                window.location.href = 'feed.html';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        showLoading(loginForm);
        
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        
        // Redireciona para o feed após login bem-sucedido
        window.location.href = 'feed.html';
        
    } catch (error) {
        console.error('Erro no login:', error);
        showError(loginError, getErrorMessage(error));
    } finally {
        hideLoading(loginForm);
    }
}

// Registro
async function handleRegister(e) {
    e.preventDefault();
    
    const nome = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const birthDate = document.getElementById('registerBirthDate').value;

    if (password.length < 6) {
        showError(registerError, 'A senha deve ter pelo menos 6 caracteres');
        return;
    }

    // Calcular idade para determinar monitoramento
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }

    // Determinar se usuário precisa de monitoramento (menores de 13 anos)
    const isMonitored = age < 13;

    try {
        showLoading(registerForm);
        
        const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nome: nome,
                    birth_date: birthDate,
                    is_monitored: isMonitored
                }
            }
        });

        if (error) throw error;

        // Fazer login automático após cadastro (sem verificação de email)
        const { data: loginData, error: loginError } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (loginError) throw loginError;

        currentUser = loginData.user;

        showSuccess(registerError, 'Conta criada com sucesso! Redirecionando...');
        
        // Redirecionar para o feed após 2 segundos
        setTimeout(() => {
            window.location.href = 'feed.html';
        }, 2000);
        
    } catch (error) {
        console.error('Erro no registro:', error);
        showError(registerError, getErrorMessage(error));
    } finally {
        hideLoading(registerForm);
    }
}

// Funções utilitários
function showSuccess(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.style.background = 'rgba(57, 255, 20, 0.1)';
        element.style.borderColor = 'rgba(57, 255, 20, 0.3)';
        element.style.color = 'rgba(57, 255, 20, 0.9)';
        
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

function showLoading(form) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Carregando...';
    }
}

function hideLoading(form) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = false;
        if (form === loginForm) {
            btn.textContent = 'Entrar';
        } else if (form === registerForm) {
            btn.textContent = 'Cadastrar';
        }
    }
}

function showError(element, message, type = 'error') {
    if (!element) return;
    
    element.textContent = message;
    element.style.display = 'block';
    
    if (type === 'success') {
        element.style.background = 'rgba(16, 185, 129, 0.1)';
        element.style.color = '#10b981';
    } else {
        element.style.background = 'rgba(239, 68, 68, 0.1)';
        element.style.color = '#ef4444';
    }
}

function getErrorMessage(error) {
    switch (error.message) {
        case 'Invalid login credentials':
            return 'E-mail ou senha incorretos';
        case 'User already registered':
            return 'Este e-mail já está cadastrado';
        case 'Password should be at least 6 characters':
            return 'A senha deve ter pelo menos 6 caracteres';
        case 'To signup, please provide your email':
            return 'Por favor, forneça um e-mail válido';
        case 'Signup requires a valid password':
            return 'Por favor, forneça uma senha válida';
        default:
            return 'Ocorreu um erro. Tente novamente.';
    }
}

function hideLoadingScreen() {
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 300);
        }, 500);
    }
}

// Exportar para uso em outros arquivos se necessário
window.authUtils = {
    supabase: window.supabaseClient,
    currentUser,
    checkAuthStatus
};
