// Configuração do Supabase Storage
const BUCKET_NAME = 'midia';

// Estado da aplicação
let currentUser = null;
let posts = [];
let isLoading = false;
let hasMorePosts = true;
let currentPage = 0;
const POSTS_PER_PAGE = 10;

// Elementos do DOM
const loadingScreen = document.getElementById('loadingScreen');
const newPostModal = document.getElementById('newPostModal');
const newPostForm = document.getElementById('newPostForm');
const postsFeed = document.getElementById('postsFeed');
const feedLoading = document.getElementById('feedLoading');
const emptyState = document.getElementById('emptyState');
const userName = document.getElementById('userName');
const userClass = document.getElementById('userClass');
const userAvatar = document.getElementById('userAvatar');

// Profile Setup Elements
const profileSetupModal = document.getElementById('profileSetupModal');
const profilePreview = document.getElementById('profilePreview');
const profileFileInput = document.getElementById('profileFileInput');
const chooseGalleryBtn = document.getElementById('chooseGalleryBtn');
const takePhotoBtn = document.getElementById('takePhotoBtn');
const cameraSection = document.getElementById('cameraSection');
const cameraPreview = document.getElementById('cameraPreview');
const captureBtn = document.getElementById('captureBtn');
const closeProfileSetupBtn = document.getElementById('closeProfileSetupBtn');
const skipProfileBtn = document.getElementById('skipProfileBtn');

// Comments Elements
const commentsModal = document.getElementById('commentsModal');
const commentsPostMedia = document.getElementById('commentsPostMedia');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentText = document.getElementById('commentText');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');

// Notifications Elements
const notificationsBtn = document.getElementById('notificationsBtn');
const notificationsModal = document.getElementById('notificationsModal');
const notificationsList = document.getElementById('notificationsList');
const notificationsBadge = document.getElementById('notificationsBadge');
const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
const emptyNotifications = document.getElementById('emptyNotifications');

// Report Elements
const reportModal = document.getElementById('reportModal');
const reportForm = document.getElementById('reportForm');
const reportReason = document.getElementById('reportReason');
const reportDescription = document.getElementById('reportDescription');
const reportError = document.getElementById('reportError');
const closeReportBtn = document.getElementById('closeReportBtn');

// Profile Setup State
let cameraStream = null;
let currentProfileImage = null;

// Comments State
let currentPostId = null;
let userLikes = new Set();

// Notifications State
let notifications = [];
let unreadCount = 0;

// Report State
let currentReportTarget = null;
let currentReportType = null;

// Story State
let storyProgressInterval;

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkAuthStatus();
    if (currentUser) {
        await loadUserProfile();
        await loadPosts();
        await loadNotifications();
        setupRealtime();
        
        // Forçar refresh dos stories ao carregar página
        setTimeout(async () => {
            const hasActiveStory = await checkUserHasActiveStory();
            updateUserStoryUI(!!hasActiveStory);
        }, 1000);
    }
    hideLoadingScreen();
});

// Configurar event listeners
function setupEventListeners() {
    // Botões
    const newPostBtn = document.getElementById('newPostBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Story do usuário
    const userStoryItem = document.querySelector('.user-story');
    if (userStoryItem) {
        userStoryItem.addEventListener('click', handleUserStoryClick);
    }
    const uploadBtn = document.getElementById('uploadBtn');
    const removeMediaBtn = document.getElementById('removeMediaBtn');

    if (newPostBtn) newPostBtn.addEventListener('click', () => {
        newPostModal.classList.remove('hidden');
    });

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeNewPostModal);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (uploadBtn) uploadBtn.addEventListener('click', handleMediaUpload);
    if (removeMediaBtn) removeMediaBtn.addEventListener('click', removeMediaPreview);

    // Formulário
    if (newPostForm) newPostForm.addEventListener('submit', handleNewPost);
    
    // Listener para textarea
    const postCaption = document.getElementById('postCaption');
    if (postCaption) {
        postCaption.addEventListener('input', checkPostReady);
    }

    // Profile Setup Event Listeners
    if (chooseGalleryBtn) chooseGalleryBtn.addEventListener('click', () => {
        profileFileInput.click();
    });

    if (profileFileInput) profileFileInput.addEventListener('change', handleProfileFileSelect);

    if (takePhotoBtn) takePhotoBtn.addEventListener('click', startCamera);

    if (captureBtn) captureBtn.addEventListener('click', capturePhoto);

    if (closeProfileSetupBtn) closeProfileSetupBtn.addEventListener('click', closeProfileSetup);

    if (skipProfileBtn) skipProfileBtn.addEventListener('click', closeProfileSetup);

    // Comments Event Listeners
    if (closeCommentsBtn) closeCommentsBtn.addEventListener('click', closeCommentsModal);
    if (commentForm) commentForm.addEventListener('submit', handleCommentSubmit);
    
    // Enter para enviar comentário
    if (commentText) commentText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommentSubmit(new Event('submit'));
        }
    });

    // Infinite scroll
    window.addEventListener('scroll', handleInfiniteScroll);

    // Fechar modal ao clicar fora
    if (newPostModal) newPostModal.addEventListener('click', (e) => {
        if (e.target === newPostModal) {
            closeNewPostModal();
        }
    });

    if (commentsModal) commentsModal.addEventListener('click', (e) => {
        if (e.target === commentsModal) {
            closeCommentsModal();
        }
    });

    // Notifications Event Listeners
    if (notificationsBtn) notificationsBtn.addEventListener('click', openNotifications);
    if (closeNotificationsBtn) closeNotificationsBtn.addEventListener('click', closeNotificationsModal);
    
    if (notificationsModal) notificationsModal.addEventListener('click', (e) => {
        if (e.target === notificationsModal) {
            closeNotificationsModal();
        }
    });

    // Report Event Listeners
    if (closeReportBtn) closeReportBtn.addEventListener('click', closeReportModal);
    if (reportForm) reportForm.addEventListener('submit', handleReportSubmit);
    
    if (reportModal) reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            closeReportModal();
        }
    });
}

// Verificar status de autenticação
async function checkAuthStatus() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (!session?.user || error) {
            // Redireciona para o index se não estiver logado
            window.location.href = 'index.html';
            return;
        }

        currentUser = session.user;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.href = 'index.html';
    }
}

// Carregar perfil do usuário
async function loadUserProfile() {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id);

        if (error) throw error;

        // Se não encontrar perfil, cria um básico
        if (!data || data.length === 0) {
            console.log('Perfil não encontrado, criando perfil básico...');
            const { data: newProfile, error: insertError } = await window.supabaseClient
                .from('profiles')
                .insert({
                    id: currentUser.id,
                    nome: currentUser.user_metadata?.nome || 'Usuário',
                    turma: 'Comunidade'
                })
                .select()
                .single();

            if (insertError) {
                console.error('Erro ao criar perfil:', insertError);
                // Usa dados básicos do auth como fallback
                updateSidebarProfileCard({
                    nome: currentUser.user_metadata?.nome || 'Usuário',
                    turma: 'Comunidade'
                });
                return;
            }

            data = [newProfile];
        }

        const profileData = data[0];

        if (profileData && userName && userClass) {
            userName.textContent = profileData.nome;
            userClass.textContent = profileData.turma;
            
            if (profileData.avatar_url && userAvatar) {
                userAvatar.src = profileData.avatar_url;
            } else {
                // Fallback avatar NGC
                userAvatar.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Cdefs%3E%3ClinearGradient id=%22neonGrad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%2339FF14%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%2300FFFF%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22url(%23neonGrad)%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2216%22 font-weight=%22bold%22%3E?%3C/text%3E%3C/svg%3E';
            }
        }

        // Atualizar card de perfil no sidebar
        updateSidebarProfileCard(profileData);
        
        // Verificar se usuário tem story ativo (forçar refresh)
        const hasActiveStory = await checkUserHasActiveStory();
        updateUserStoryUI(!!hasActiveStory);
        
        // Forçar limpeza de cache do Supabase
        setTimeout(async () => {
            const freshCheck = await checkUserHasActiveStory();
            updateUserStoryUI(!!freshCheck);
        }, 500);
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        // Fallback com dados básicos
        updateSidebarProfileCard({
            nome: currentUser.user_metadata?.nome || 'Usuário',
            turma: 'Comunidade'
        });
    }
}

// Atualizar card de perfil no sidebar
function updateSidebarProfileCard(userData) {
    const sidebarAvatar = document.getElementById('sidebarProfileAvatar');
    const sidebarName = document.getElementById('sidebarProfileName');
    
    if (sidebarAvatar && sidebarName && userData) {
        sidebarName.textContent = userData.nome || 'Usuário';
        
        if (userData.avatar_url) {
            sidebarAvatar.src = userData.avatar_url;
        } else {
            // Fallback avatar NGC
            sidebarAvatar.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 48 48\'%3E%3Cdefs%3E%3ClinearGradient id=%22neonGrad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%2339FF14%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%2300FFFF%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx=%2224%22 cy=%2224%22 r=%2224%22 fill=%22url(%23neonGrad)%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2220%22 font-weight=%22bold%22%3E?%3C/text%3E%3C/svg%3E';
        }
    }
}

// Logout
async function handleLogout() {
    try {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// Carregar posts com contagem real do banco
async function loadPosts(reset = false) {
    if (isLoading || (!hasMorePosts && !reset)) return;
    
    try {
        isLoading = true;
        
        if (reset) {
            currentPage = 0;
            posts = [];
            if (postsFeed) postsFeed.innerHTML = '';
            if (emptyState) emptyState.classList.add('hidden');
        }
        
        if (feedLoading) showLoading(feedLoading);
        
        const { data, error } = await window.supabaseClient
            .from('posts')
            .select(`
                *,
                profiles: user_id (
                    id,
                    nome,
                    turma,
                    avatar_url
                )
            `)
            .order('created_at', { ascending: false })
            .range(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE - 1);

        if (error) throw error;

        posts = reset ? data : [...posts, ...data];
        
        // Carregar likes do usuário atual
        await loadUserLikes();
        
        // Carregar contagens de likes para todos os posts
        await loadPostsLikeCounts();
        
        // Renderizar posts com contagem real
        await renderPosts();
        
        currentPage++;
    } catch (error) {
        console.error('Erro ao carregar posts:', error);
    } finally {
        isLoading = false;
        if (feedLoading) hideLoading(feedLoading);
    }
}

// Renderizar posts e carregar informações de quem curtiu
async function renderPosts() {
    if (!postsFeed) return;
    
    if (posts.length === 0) {
        postsFeed.innerHTML = `
            <div class="empty-feed">
                <div class="empty-icon">📝</div>
                <h3 class="empty-title">Nenhum post ainda</h3>
                <p class="empty-description">Seja o primeiro a compartilhar algo!</p>
            </div>
        `;
        return;
    }
    
    postsFeed.innerHTML = posts.map(post => createPostHTML(post)).join('');
    
    // Carregar informações de quem curtiu APENAS para posts que o usuário atual curtiu
    for (const post of posts) {
        if (userLikes.has(post.id) && (post.likes?.[0]?.count || 0) > 0) {
            loadLikesInfo(post.id);
        }
    }
}

// Criar HTML do post
function createPostHTML(post) {
    const profile = post.profiles;
    const isOwner = profile?.id === currentUser?.id;
    const isLiked = userLikes.has(post.id);
    
    const mediaHTML = post.media_url ? (post.media_type === 'video' 
        ? `<div class="post-media"><video controls><source src="${post.media_url}" type="video/mp4"></video></div>`
        : `<div class="post-media"><img src="${post.media_url}" alt="Post" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22 viewBox=%220 0 400 300%22%3E%3Crect width=%22400%22 height=%22300%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239ca3af%22 font-family=%22Arial%22 font-size=%2216%22%3EImagem não encontrada%3C/text%3E%3C/svg%3E'"></div>`) : '';

    return `
        <div class="post-card glass ${!post.media_url ? 'text-only' : ''}">
            <div class="post-header">
                <img src="${profile?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2245%22 height=%2245%22 viewBox=%220 0 45 45%22%3E%3Cdefs%3E%3ClinearGradient id=%22neonGrad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%2339FF14%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%2300FFFF%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx=%2222.5%22 cy=%2222.5%22 r=%2222.5%22 fill=%22url(%23neonGrad)%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2220%22 font-weight=%22bold%22%3E?%3C/text%3E%3C/svg%3E'}" alt="${profile?.nome || 'Usuário'}" class="post-avatar">
                <div class="post-info">
                    <h4>${profile?.nome || 'Usuário'}</h4>
                    <span>${profile?.turma || 'Comunidade'} • ${formatDate(post.created_at)}</span>
                </div>
                ${isOwner ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')" title="Excluir post">
                    <svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19 L6 7 L18 7 L18 19 L16 21 L8 21 L6 19 M19 4 L15 4 L14 3 L9 3 L8 4 L5 4 L5 6 L19 6 L19 4"/>
                    </svg>
                </button>` : `<button class="report-post-btn" onclick="openReportModal('${post.id}', 'post')" title="Denunciar post">
                    <svg class="report-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                </button>`}
            </div>
            ${post.caption ? `<div class="post-caption">${post.caption}</div>` : ''}
            ${mediaHTML}
            <div class="post-actions">
                <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span>${post.likes?.[0]?.count || 0}</span>
                </button>
                <button class="action-btn comment-btn" onclick="openComments('${post.id}', '${post.media_url || ''}', '${post.media_type || ''}', '${(post.caption || '').replace(/'/g, "\\'")}')">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>${post.comments_count || 0}</span>
                </button>
                <button class="action-btn share-btn">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span>${post.shares_count || 0}</span>
                </button>
            </div>
            <div class="post-likes-info" id="likes-info-${post.id}" style="display: none;">
                <!-- Será preenchido dinamicamente -->
            </div>
        </div>
    `;
}

// ...
async function deletePost(postId) {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;
    
    try {
        showLoading(postsFeed);
        
        // Primeiro, deletar a mídia do Storage se existir
        const post = posts.find(p => p.id === postId);
        if (post?.media_url) {
            const filePath = post.media_url.split('/').pop();
            await window.supabaseClient.storage
                .from(BUCKET_NAME)
                .remove([`${currentUser.id}/${filePath}`]);
        }
        
        // Deletar o post do banco
        const { error } = await window.supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('user_id', currentUser.id); // Segurança extra
        
        if (error) throw error;
        
        // Remover do array e recarregar
        posts = posts.filter(p => p.id !== postId);
        renderPosts();
        
        showUploadFeedback('Post excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao excluir post:', error);
        showUploadFeedback('Erro ao excluir post. Tente novamente.', 'error');
    } finally {
        hideLoading(postsFeed);
    }
}

// Upload de mídia para Supabase Storage
async function handleMediaUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Mostrar feedback de upload
        showUploadFeedback('Enviando...');
        
        try {
            const fileName = `${Date.now()}-${file.name}`;
            const filePath = `${currentUser.id}/${fileName}`;
            
            // Upload para o Supabase Storage
            const { data, error } = await window.supabaseClient.storage
                .from(BUCKET_NAME)
                .upload(filePath, file);
            
            if (error) throw error;
            
            // Obter URL pública
            const { data: { publicUrl } } = window.supabaseClient.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);
            
            // Mostrar preview
            showMediaPreview(publicUrl, file.type);
            showUploadFeedback('Arquivo enviado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro no upload:', error);
            showUploadFeedback('Erro ao enviar arquivo. Tente novamente.', 'error');
        }
    };
    input.click();
}

// Feedback de upload verde neon
function showUploadFeedback(message, type = 'info') {
    // Remover feedback anterior se existir
    const existingFeedback = document.querySelector('.upload-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Criar elemento de feedback
    const feedback = document.createElement('div');
    feedback.className = 'upload-feedback';
    feedback.textContent = message;
    
    // Estilo verde neon
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: linear-gradient(135deg, rgba(57, 255, 20, 0.9) 0%, rgba(0, 255, 65, 0.9) 100%);
        color: white;
        border-radius: 12px;
        font-size: 0.875rem;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(57, 255, 20, 0.4), 0 0 20px rgba(57, 255, 20, 0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(57, 255, 20, 0.3);
    `;
    
    if (type === 'error') {
        feedback.style.background = 'linear-gradient(135deg, rgba(244, 63, 94, 0.9) 0%, rgba(236, 72, 153, 0.9) 100%)';
        feedback.style.boxShadow = '0 4px 20px rgba(244, 63, 94, 0.4), 0 0 20px rgba(244, 63, 94, 0.2)';
        feedback.style.borderColor = 'rgba(244, 63, 94, 0.3)';
    }
    
    document.body.appendChild(feedback);
    
    // Remover após 3 segundos
    setTimeout(() => {
        feedback.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

// Adicionar animações ao CSS
const uploadStyles = document.createElement('style');
uploadStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(uploadStyles);

// Mostrar preview da mídia
function showMediaPreview(url, type) {
    const preview = document.getElementById('mediaPreview');
    const container = document.getElementById('previewContainer');
    const submitBtn = document.querySelector('.submit-btn');
    
    if (preview && container) {
        preview.src = url;
        document.getElementById('mediaUrl').value = url;
        document.getElementById('mediaType').value = type;
        
        container.classList.remove('hidden');
    }
    
    // Verificar se o post pode ser publicado
    checkPostReady();
}

// Verificar se post está pronto para publicar
function checkPostReady() {
    const caption = document.getElementById('postCaption')?.value;
    const mediaUrl = document.getElementById('mediaUrl')?.value;
    const submitBtn = document.querySelector('.submit-btn');
    
    if (submitBtn) {
        submitBtn.disabled = !caption && !mediaUrl;
    }
}

// Remover preview da mídia
function removeMediaPreview() {
    const container = document.getElementById('previewContainer');
    
    if (container) {
        container.classList.add('hidden');
        document.getElementById('mediaUrl').value = '';
        document.getElementById('mediaType').value = '';
    }
    
    // Verificar se o post ainda pode ser publicado
    checkPostReady();
}

// Criar novo post
async function handleNewPost(e) {
    e.preventDefault();
    
    const caption = document.getElementById('postCaption')?.value;
    const mediaUrl = document.getElementById('mediaUrl')?.value;
    const mediaType = document.getElementById('mediaType')?.value;

    // Permitir posts só com texto ou com mídia
    if (!caption && !mediaUrl) {
        showUploadFeedback('Adicione um texto ou uma mídia para postar', 'error');
        return;
    }

    try {
        showLoading(newPostForm);

        const { data, error } = await window.supabaseClient
            .from('posts')
            .insert({
                user_id: currentUser.id,
                media_url: mediaUrl || null,
                media_type: mediaType || null,
                caption: caption || null
            })
            .select()
            .single();

        if (error) throw error;

        closeNewPostModal();
        await loadPosts(true); // Recarregar posts do início
        showUploadFeedback('Post publicado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao criar post:', error);
        showUploadFeedback('Erro ao criar post. Tente novamente.', 'error');
    } finally {
        hideLoading(newPostForm);
    }
}

// Infinite scroll
function handleInfiniteScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
        loadPosts();
    }
}

// Funções utilitárias
function showLoading(element) {
    if (!element) return;
    
    const btn = element.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Carregando...';
    }
}

function hideLoading(element) {
    if (!element) return;
    
    const btn = element.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = false;
        if (element === newPostForm) {
            btn.textContent = 'Publicar';
        }
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffDays < 7) return `há ${diffDays} d`;
    
    return date.toLocaleDateString('pt-BR');
}

function closeNewPostModal() {
    if (newPostModal) {
        newPostModal.classList.add('hidden');
        resetNewPostForm();
    }
}

function resetNewPostForm() {
    if (newPostForm) {
        newPostForm.reset();
        mediaUrl = null;
        mediaType = null;
        removeMediaPreview();
        checkPostReady();
    }
}

// Profile Setup Functions
function showProfileSetup() {
    if (profileSetupModal) {
        profileSetupModal.classList.remove('hidden');
    }
}

function closeProfileSetup() {
    if (profileSetupModal) {
        profileSetupModal.classList.add('hidden');
        stopCamera();
        resetProfileSetup();
    }
}

function resetProfileSetup() {
    currentProfileImage = null;
    profilePreview.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\' viewBox=\'0 0 120 120\'%3E%3Crect width=\'120\' height=\'120\' fill=\'%2339FF14\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\' font-size=\'60\'%3E?%3C/text%3E%3C/svg%3E';
    cameraSection.classList.add('hidden');
}

function handleProfileFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentProfileImage = e.target.result;
            profilePreview.src = currentProfileImage;
            uploadProfileImage(file);
        };
        reader.readAsDataURL(file);
    }
}

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
        });
        cameraPreview.srcObject = cameraStream;
        cameraSection.classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao acessar câmera:', error);
        alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        cameraPreview.srcObject = null;
    }
}

function capturePhoto() {
    const canvas = document.createElement('canvas');
    canvas.width = cameraPreview.videoWidth;
    canvas.height = cameraPreview.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraPreview, 0, 0);
    
    canvas.toBlob((blob) => {
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        const reader = new FileReader();
        reader.onload = (e) => {
            currentProfileImage = e.target.result;
            profilePreview.src = currentProfileImage;
            uploadProfileImage(file);
        };
        reader.readAsDataURL(file);
    }, 'image/jpeg', 0.8);
    
    stopCamera();
    cameraSection.classList.add('hidden');
}

async function uploadProfileImage(file) {
    try {
        showLoading(profileSetupModal);
        
        const fileName = `${currentUser.id}/profile.jpg`;
        const { data, error } = await window.supabaseClient.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;

        // Obter URL pública
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Atualizar perfil
        const { error: updateError } = await window.supabaseClient
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        // Atualizar avatar no header
        if (userAvatar) {
            userAvatar.src = publicUrl;
        }

        // Fechar modal após sucesso
        setTimeout(() => {
            closeProfileSetup();
        }, 1000);

    } catch (error) {
        console.error('Erro ao fazer upload da foto de perfil:', error);
        alert('Erro ao fazer upload da foto. Tente novamente.');
    } finally {
        hideLoading(profileSetupModal);
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

// Funções de Interação Social

// Carregar likes do usuário e quem curtiu
async function loadUserLikes() {
    try {
        // Limpar likes antigos para garantir sincronia
        userLikes.clear();
        
        const { data, error } = await window.supabaseClient
            .from('likes')
            .select('post_id')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        userLikes = new Set(data.map(like => like.post_id));
    } catch (error) {
        console.error('Erro ao carregar likes:', error);
    }
}

// Carregar contagens de likes para todos os posts
async function loadPostsLikeCounts() {
    try {
        // Para cada post, buscar a contagem de likes
        for (const post of posts) {
            const { data, error } = await window.supabaseClient
                .from('likes')
                .select('id', { count: 'exact' })
                .eq('post_id', post.id);

            if (error) throw error;

            // Adicionar contagem ao post
            post.likes = [{ count: data.length }];
        }
    } catch (error) {
        console.error('Erro ao carregar contagens de likes:', error);
    }
}

// Buscar quem curtiu o post mais recente
async function getLatestLike(postId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('likes')
            .select(`
                profiles: user_id (
                    id,
                    nome,
                    avatar_url
                )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;
        
        return data?.profiles;
    } catch (error) {
        console.error('Erro ao buscar like recente:', error);
        return null;
    }
}

// Toggle like usando RPC function para garantir consistência
async function toggleLike(postId) {
    try {
        // Usar RPC function para toggle like com atualização automática
        const { data, error } = await window.supabaseClient
            .rpc('toggle_post_like', {
                post_uuid: postId,
                user_uuid: currentUser.id
            });

        if (error) throw error;

        const result = data[0]; // { liked: boolean, total_likes: integer }
        
        // Atualizar estado local
        if (result.liked) {
            userLikes.add(postId);
        } else {
            userLikes.delete(postId);
        }
        
        // Atualizar contador no post localmente
        const post = posts.find(p => p.id === postId);
        if (post) {
            // Atualizar a estrutura de likes para manter consistência
            post.likes = [{ count: result.total_likes }];
        }
        
        // Atualizar apenas o contador do botão
        updateLikeButton(postId, result.liked, result.total_likes);
        
        // Atualizar informações de quem curtiu se tiver likes (sem await para evitar piscar)
        if (result.total_likes > 0) {
            loadLikesInfo(postId);
        } else {
            // Esconder informações de likes se não tiver mais
            const likesInfo = document.getElementById(`likes-info-${postId}`);
            if (likesInfo) {
                likesInfo.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error('Erro ao fazer toggle like:', error);
        alert('Erro ao curtir/descurtir post. Tente novamente.');
    }
}

// Atualizar apenas o botão de like específico
function updateLikeButton(postId, isLiked, totalLikes) {
    const likeButton = document.querySelector(`button[onclick="toggleLike('${postId}')"]`);
    if (likeButton) {
        // Atualizar classe liked
        if (isLiked) {
            likeButton.classList.add('liked');
        } else {
            likeButton.classList.remove('liked');
        }
        
        // Atualizar contador
        const span = likeButton.querySelector('span');
        if (span) {
            span.textContent = totalLikes;
        }
        
        // Atualizar ícone
        const svg = likeButton.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
        }
    }
}

// Abrir modal de comentários
async function openComments(postId, mediaUrl, mediaType, caption) {
    try {
        currentPostId = postId;
        
        // Configurar mídia do post
        if (commentsPostMedia) {
            let mediaHTML = '';
            
            if (mediaUrl) {
                if (mediaType === 'video') {
                    mediaHTML = `<video class="comments-post-video" controls><source src="${mediaUrl}" type="video/mp4"></video>`;
                } else {
                    mediaHTML = `<img src="${mediaUrl}" alt="Post" class="comments-post-image">`;
                }
            } else if (caption) {
                // Se não tem mídia mas tem texto, mostrar o texto
                mediaHTML = `<div class="comments-post-text">${caption}</div>`;
            } else {
                // Se não tem nada, mostrar placeholder
                mediaHTML = `<div class="comments-post-text">Post sem conteúdo</div>`;
            }
            
            commentsPostMedia.innerHTML = mediaHTML;
        }
        
        // Carregar comentários
        await loadComments();
        
        // Abrir modal
        if (commentsModal) {
            commentsModal.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Erro ao abrir comentários:', error);
    }
}

// Carregar comentários do post
async function loadComments() {
    try {
        const { data, error } = await window.supabaseClient
            .from('comments')
            .select(`
                *,
                profiles: user_id (
                    id,
                    nome,
                    avatar_url
                )
            `)
            .eq('post_id', currentPostId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        renderComments(data);
        
    } catch (error) {
        console.error('Erro ao carregar comentários:', error);
    }
}

// Renderizar comentários
function renderComments(comments) {
    if (!commentsList) return;
    
    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div class="empty-comments">
                <p>Nenhum comentário ainda. Seja o primeiro a comentar!</p>
            </div>
        `;
        return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item">
            <img src="${comment.profiles?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2236%22 height=%2236%22 viewBox=%220 0 36 36%22%3E%3Cdefs%3E%3ClinearGradient id=%22neonGrad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%2339FF14%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%2300FFFF%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx=%2218%22 cy=%2218%22 r=%2218%22 fill=%22url(%23neonGrad)%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2216%22 font-weight=%22bold%22%3E?%3C/text%3E%3C/svg%3E'}" alt="${comment.profiles?.nome || 'Usuário'}" class="comment-avatar">
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-author">${comment.profiles?.nome || 'Usuário'}</span>
                    <span class="comment-time">${formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-text">${comment.content}</div>
            </div>
        </div>
    `).join('');
}

// Enviar comentário
async function handleCommentSubmit(event) {
    event.preventDefault();
    
    if (!commentText || !commentText.value.trim()) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('comments')
            .insert({
                post_id: currentPostId,
                user_id: currentUser.id,
                content: commentText.value.trim()
            });
        
        if (error) throw error;
        
        // Limpar campo
        commentText.value = '';
        
        // Recarregar comentários
        await loadComments();
        
        // Atualizar contador no post
        const post = posts.find(p => p.id === currentPostId);
        if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            renderPosts();
        }
        
    } catch (error) {
        console.error('Erro ao enviar comentário:', error);
        alert('Erro ao enviar comentário. Tente novamente.');
    }
}

// Fechar modal de comentários
function closeCommentsModal() {
    if (commentsModal) {
        commentsModal.classList.add('hidden');
        currentPostId = null;
        if (commentText) commentText.value = '';
    }
}

// Funções de Notificações

// Carregar notificações do usuário
async function loadNotifications() {
    try {
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Buscar perfis dos atores separadamente
        if (data && data.length > 0) {
            const actorIds = [...new Set(data.map(n => n.actor_id).filter(id => id))];
            
            if (actorIds.length > 0) {
                const { data: profiles } = await window.supabaseClient
                    .from('profiles')
                    .select('id, nome, avatar_url')
                    .in('id', actorIds);
                
                // Mapear perfis para fácil acesso
                const profilesMap = {};
                if (profiles) {
                    profiles.forEach(profile => {
                        profilesMap[profile.id] = profile;
                    });
                }
                
                // Adicionar perfil a cada notificação
                notifications = data.map(notification => ({
                    ...notification,
                    profiles: profilesMap[notification.actor_id] || null
                }));
            } else {
                notifications = data || [];
            }
        } else {
            notifications = [];
        }
        
        updateNotificationsBadge();
        
    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
    }
}

// Atualizar badge de notificações
function updateNotificationsBadge() {
    unreadCount = notifications.filter(n => !n.read).length;
    
    if (notificationsBadge) {
        if (unreadCount > 0) {
            notificationsBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notificationsBadge.classList.remove('hidden');
        } else {
            notificationsBadge.classList.add('hidden');
        }
    }
}

// Abrir modal de notificações
async function openNotifications() {
    try {
        if (notificationsModal) {
            notificationsModal.classList.remove('hidden');
            await renderNotifications();
        }
    } catch (error) {
        console.error('Erro ao abrir notificações:', error);
    }
}

// Fechar modal de notificações
function closeNotificationsModal() {
    if (notificationsModal) {
        notificationsModal.classList.add('hidden');
    }
}

// Renderizar notificações
async function renderNotifications() {
    if (!notificationsList) return;
    
    if (notifications.length === 0) {
        notificationsList.classList.add('hidden');
        if (emptyNotifications) emptyNotifications.classList.remove('hidden');
        return;
    }
    
    notificationsList.classList.remove('hidden');
    if (emptyNotifications) emptyNotifications.classList.add('hidden');
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${!notification.read ? 'unread' : ''}" onclick="markNotificationAsRead('${notification.id}')">
            <img src="${notification.profiles?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cdefs%3E%3ClinearGradient id=%22neonGrad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%2339FF14%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%2300FFFF%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22url(%23neonGrad)%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2218%22 font-weight=%22bold%22%3E?%3C/text%3E%3C/svg%3E'}" alt="${notification.profiles?.nome || 'Usuário'}" class="notification-avatar">
            <div class="notification-content">
                <div class="notification-text">
                    <strong>${notification.profiles?.nome || 'Alguém'}</strong> ${notification.content}
                </div>
                <div class="notification-time">${formatDate(notification.created_at)}</div>
                <div class="notification-type ${notification.type}">
                    ${notification.type === 'like' ? '❤️ Curtiu' : '💬 Comentou'}
                </div>
            </div>
        </div>
    `).join('');
}

// Marcar notificação como lida
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Atualizar estado local
        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            updateNotificationsBadge();
            await renderNotifications();
        }
        
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
    }
}

// Setup de Realtime
function setupRealtime() {
    // Realtime para novos posts
    const postsChannel = window.supabaseClient
        .channel('posts_changes')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'posts' 
            },
            async (payload) => {
                // Novo post criado - adicionar ao topo do feed
                const newPost = payload.new;
                
                // Buscar dados completos do post com perfil
                const { data: postData } = await window.supabaseClient
                    .from('posts')
                    .select(`
                        *,
                        profiles: user_id (
                            id,
                            nome,
                            turma,
                            avatar_url
                        )
                    `)
                    .eq('id', newPost.id)
                    .single();
                
                if (postData) {
                    // Adicionar ao topo do array com animação
                    posts.unshift(postData);
                    
                    // Renderizar com animação de entrada
                    const postHTML = createPostHTML(postData);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = postHTML;
                    const newPostElement = tempDiv.firstElementChild;
                    
                    // Adicionar classe de animação
                    newPostElement.style.animation = 'slideInFromTop 0.5s ease-out';
                    
                    // Inserir no topo do feed
                    if (postsFeed) {
                        postsFeed.insertBefore(newPostElement, postsFeed.firstChild);
                        
                        // Remover animação após completar
                        setTimeout(() => {
                            newPostElement.style.animation = '';
                        }, 500);
                    }
                    
                    // Mostrar feedback visual
                    showNewPostNotification();
                }
            }
        )
        .subscribe();

    // Realtime para novas notificações
    const notificationsChannel = window.supabaseClient
        .channel('notifications_changes')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            },
            async (payload) => {
                // Nova notificação recebida
                const newNotification = payload.new;
                
                // Buscar perfil do ator separadamente
                if (newNotification.actor_id) {
                    const { data: profileData } = await window.supabaseClient
                        .from('profiles')
                        .select('id, nome, avatar_url')
                        .eq('id', newNotification.actor_id)
                        .single();
                    
                    // Adicionar perfil à notificação
                    const notificationData = {
                        ...newNotification,
                        profiles: profileData
                    };
                    
                    // Adicionar ao topo das notificações
                    notifications.unshift(notificationData);
                    updateNotificationsBadge();
                    
                    // Mostrar feedback visual
                    showNotificationFeedback(notificationData);
                }
            }
        )
        .subscribe();
}

// Feedback visual para novo post
function showNewPostNotification() {
    const feedback = document.createElement('div');
    feedback.className = 'new-post-notification';
    feedback.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">📸</span>
            <span class="notification-text">Novo post no feed!</span>
        </div>
    `;
    
    feedback.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, rgba(57, 255, 20, 0.9) 0%, rgba(0, 255, 65, 0.9) 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 0.875rem;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(57, 255, 20, 0.4);
        z-index: 1000;
        animation: slideInFromRight 0.5s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(57, 255, 20, 0.3);
    `;
    
    document.body.appendChild(feedback);
    
    // Remover após 3 segundos
    setTimeout(() => {
        feedback.style.animation = 'slideOutToRight 0.3s ease-out';
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

// Feedback visual para nova notificação
function showNotificationFeedback(notification) {
    const feedback = document.createElement('div');
    feedback.className = 'notification-feedback';
    feedback.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${notification.type === 'like' ? '❤️' : '💬'}</span>
            <span class="notification-text">${notification.profiles?.nome || 'Alguém'} ${notification.type === 'like' ? 'curtiu' : 'comentou'}</span>
        </div>
    `;
    
    feedback.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, rgba(57, 255, 20, 0.9) 0%, rgba(0, 255, 65, 0.9) 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 0.875rem;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(57, 255, 20, 0.4);
        z-index: 1000;
        animation: slideInFromRight 0.5s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(57, 255, 20, 0.3);
    `;
    
    document.body.appendChild(feedback);
    
    // Remover após 4 segundos
    setTimeout(() => {
        feedback.style.animation = 'slideOutToRight 0.3s ease-out';
        setTimeout(() => feedback.remove(), 300);
    }, 4000);
}

// Adicionar animações ao CSS
const realtimeStyles = document.createElement('style');
realtimeStyles.textContent = `
    @keyframes slideInFromTop {
        from { 
            transform: translateY(-100%);
            opacity: 0;
        }
        to { 
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideInFromRight {
        from { 
            transform: translateX(100%);
            opacity: 0;
        }
        to { 
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutToRight {
        from { 
            transform: translateX(0);
            opacity: 1;
        }
        to { 
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(realtimeStyles);

// Exportar para uso global se necessário
window.feedUtils = {
    toggleLike,
    loadPosts,
    openReportModal,
    handleReportSubmit
};

// Nexus Safe - Sistema de Denúncias

// Abrir modal de denúncia
function openReportModal(targetId, targetType) {
    currentReportTarget = targetId;
    currentReportType = targetType;
    
    if (reportModal) {
        reportModal.classList.remove('hidden');
        // Limpar formulário
        if (reportForm) reportForm.reset();
        if (reportError) reportError.style.display = 'none';
    }
}

// Fechar modal de denúncia
function closeReportModal() {
    if (reportModal) {
        reportModal.classList.add('hidden');
        currentReportTarget = null;
        currentReportType = null;
    }
}

// Enviar denúncia
async function handleReportSubmit(e) {
    e.preventDefault();
    
    const reason = reportReason?.value;
    const description = reportDescription?.value;
    
    if (!reason || !currentReportTarget) {
        if (reportError) {
            reportError.textContent = 'Selecione um motivo para a denúncia';
            reportError.style.display = 'block';
        }
        return;
    }
    
    try {
        showLoading(reportForm);
        
        // Obter ID do dono do post
        let reportedUserId = null;
        if (currentReportType === 'post') {
            const { data: postData } = await window.supabaseClient
                .from('posts')
                .select('user_id')
                .eq('id', currentReportTarget)
                .single();
            
            reportedUserId = postData?.user_id;
        }
        
        if (!reportedUserId) {
            throw new Error('Não foi possível identificar o usuário denunciado');
        }
        
        // Criar denúncia
        const { error } = await window.supabaseClient
            .from('reports')
            .insert({
                reporter_id: currentUser.id,
                reported_user_id: reportedUserId,
                post_id: currentReportType === 'post' ? currentReportTarget : null,
                reason: reason,
                description: description || null
            });
        
        if (error) throw error;
        
        // Mostrar sucesso
        showUploadFeedback('Denúncia enviada com sucesso! Agradecemos sua ajuda.', 'success');
        closeReportModal();
        
    } catch (error) {
        console.error('Erro ao enviar denúncia:', error);
        if (reportError) {
            reportError.textContent = 'Erro ao enviar denúncia. Tente novamente.';
            reportError.style.display = 'block';
        }
    } finally {
        hideLoading(reportForm);
    }
}

// Filtro de Conteúdo - Nexus Safe

// Lista de palavras ofensivas (pode ser expandida)
const offensiveWords = [
    'palavrão1', 'palavrão2', 'palavrão3', // Adicionar palavras reais aqui
    'idiota', 'burro', 'estúpido', 'imbecil',
    'porra', 'caralho', 'puta', 'merda'
];

// Verificar se conteúdo contém palavras ofensivas
function containsOffensiveContent(content) {
    if (!content) return false;
    
    const lowerContent = content.toLowerCase();
    return offensiveWords.some(word => lowerContent.includes(word.toLowerCase()));
}

// Mostrar alerta de conteúdo ofensivo
function showOffensiveContentAlert() {
    const alert = document.createElement('div');
    alert.className = 'nexus-safe-alert';
    alert.innerHTML = `
        <div class="alert-content">
            <span class="alert-icon">🛡️</span>
            <span class="alert-text">Nexus Safe: Por favor, use uma linguagem amigável!</span>
        </div>
    `;
    
    alert.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, rgba(255, 193, 7, 0.9) 0%, rgba(255, 152, 0, 0.9) 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 0.875rem;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(255, 193, 7, 0.4);
        z-index: 1000;
        animation: slideInFromRight 0.5s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 193, 7, 0.3);
    `;
    
    document.body.appendChild(alert);
    
    // Remover após 4 segundos
    setTimeout(() => {
        alert.style.animation = 'slideOutToRight 0.3s ease-out';
        setTimeout(() => alert.remove(), 300);
    }, 4000);
}

// Modificar função de envio de comentário para incluir filtro
async function handleCommentSubmit(event) {
    event.preventDefault();
    
    if (!commentText || !commentText.value.trim()) return;
    
    const commentContent = commentText.value.trim();
    
    // Verificar conteúdo ofensivo
    if (containsOffensiveContent(commentContent)) {
        showOffensiveContentAlert();
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('comments')
            .insert({
                post_id: currentPostId,
                user_id: currentUser.id,
                content: commentContent
            });
        
        if (error) throw error;
        
        // Limpar campo
        commentText.value = '';
        
        // Recarregar comentários
        await loadComments();
        
        // Atualizar contador no post
        const post = posts.find(p => p.id === currentPostId);
        if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            renderPosts();
        }
        
    } catch (error) {
        console.error('Erro ao enviar comentário:', error);
        alert('Erro ao enviar comentário. Tente novamente.');
    }
}

// Modificar função de criação de post para incluir filtro
async function handleNewPost(e) {
    e.preventDefault();
    
    const caption = document.getElementById('postCaption')?.value;
    const mediaUrl = document.getElementById('mediaUrl')?.value;
    const mediaType = document.getElementById('mediaType')?.value;

    // Permitir posts só com texto ou com mídia
    if (!caption && !mediaUrl) {
        showUploadFeedback('Adicione um texto ou uma mídia para postar', 'error');
        return;
    }
    
    // Verificar conteúdo ofensivo no caption
    if (caption && containsOffensiveContent(caption)) {
        showOffensiveContentAlert();
        return;
    }

    try {
        showLoading(newPostForm);

        const { data, error } = await window.supabaseClient
            .from('posts')
            .insert({
                user_id: currentUser.id,
                media_url: mediaUrl || null,
                media_type: mediaType || null,
                caption: caption || null
            })
            .select()
            .single();

        if (error) throw error;

        closeNewPostModal();
        await loadPosts(true); // Recarregar posts do início
        showUploadFeedback('Post publicado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao criar post:', error);
        showUploadFeedback('Erro ao criar post. Tente novamente.', 'error');
    } finally {
        hideLoading(newPostForm);
    }
}

// Código para adicionar ao final do feed.js

// Cole este código no final do arquivo feed.js (depois da linha 1590)

// Carregar informações de quem curtiu um post específico
async function loadLikesInfo(postId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('likes')
            .select(`
                profiles: user_id (
                    id,
                    nome,
                    avatar_url
                )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        
        const likesInfo = document.getElementById(`likes-info-${postId}`);
        if (likesInfo && data.length > 0) {
            const latestLike = data[0].profiles;
            
            // Usar contagem real do post (nova estrutura)
            const post = posts.find(p => p.id === postId);
            const currentCount = post?.likes?.[0]?.count || 0;
            const otherCount = Math.max(0, currentCount - 1);
            
            likesInfo.innerHTML = `
                <div class="likes-info-content">
                    <img src="${latestLike.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cdefs%3E%3ClinearGradient id=%22neonGrad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%2339FF14%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%2300FFFF%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%2212%22 fill=%22url(%23neonGrad)%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2210%22 font-weight=%22bold%22%3E?%3C/text%3E%3C/svg%3E'}" alt="Avatar" class="likes-avatar">
                    <span class="likes-text">
                        <strong>${latestLike.nome}</strong> e mais ${otherCount} ${otherCount === 1 ? 'pessoa' : 'pessoas'} curtiram isso
                    </span>
                </div>
            `;
            likesInfo.style.display = 'block';
        } else if (likesInfo) {
            // Esconder se não tiver likes
            likesInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar informações de likes:', error);
    }
}

// ==================== FUNÇÕES DE STORIES ====================

// Constantes para Stories
const STORIES_BUCKET = 'stories';

// Verificar se usuário tem story ativo
async function checkUserHasActiveStory() {
    try {
        const { data, error } = await window.supabaseClient
            .from('stories')
            .select('id, media_url, expires_at')
            .eq('user_id', currentUser.id)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Erro ao verificar story ativo:', error);
        return null;
    }
}

// Manipular clique no story do usuário
async function handleUserStoryClick() {
    // Função mantida para compatibilidade, mas o clique agora é direto no HTML
}

// Visualizar stories próprios em sequência
async function viewOwnStories() {
    try {
        // Buscar todos os stories do usuário (sem cache)
        const stories = await getAllUserStories();
        
        if (stories.length === 0) {
            // Se não tem story, abrir para postar
            openFilePicker();
            return;
        }
        
        // Abrir modal com primeiro story
        await openStoryModal(stories[0].media_url, 0, stories);
        
    } catch (error) {
        console.error('Erro ao buscar stories:', error);
        // Fallback: tentar abrir um story
        const activeStory = await checkUserHasActiveStory();
        if (activeStory) {
            openStoryModal(activeStory.media_url, 0, [activeStory]);
        } else {
            openFilePicker();
        }
    }
}

// Abrir seletor de arquivos
function openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleStoryFileSelect(e.target.files[0]);
    input.click();
}

// Manipular seleção de arquivo para story
async function handleStoryFileSelect(file) {
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
        showUploadFeedback('Por favor, selecione uma imagem.', 'error');
        return;
    }
    
    // Salvar arquivo global para uso posterior
    window.currentStoryFile = file;
    
    // Abrir modal de filtros
    openStoryFiltersModal(file);
}

// Abrir modal de filtros
function openStoryFiltersModal(file) {
    const modal = document.getElementById('story-filters-modal');
    const preview = document.getElementById('story-preview');
    const videoPreview = document.getElementById('story-video-preview');
    
    // Mostrar preview da imagem
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        videoPreview.style.display = 'none';
        
        // Resetar filtros
        window.currentStoryFilter = 'none';
        preview.style.filter = 'none';
        
        // Atualizar UI dos filtros
        document.querySelectorAll('.filter-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector('[data-filter="none"]').classList.add('active');
    };
    reader.readAsDataURL(file);
    
    // Mostrar modal
    modal.style.display = 'flex';
}

// Fechar modal de filtros
function closeStoryFiltersModal() {
    const modal = document.getElementById('story-filters-modal');
    modal.style.display = 'none';
    window.currentStoryFile = null;
    window.currentStoryFilter = null;
}

// Aplicar filtro ao preview
function applyStoryFilter(filterType) {
    const preview = document.getElementById('story-preview');
    const filters = {
        'none': 'none',
        'grayscale': 'grayscale(100%)',
        'sepia': 'sepia(100%)',
        'blur': 'blur(2px)',
        'brightness': 'brightness(1.3)',
        'contrast': 'contrast(1.5)',
        'hue-rotate': 'hue-rotate(90deg)',
        'saturate': 'saturate(2)'
    };
    
    preview.style.filter = filters[filterType] || 'none';
    window.currentStoryFilter = filterType;
    
    // Atualizar UI dos filtros
    document.querySelectorAll('.filter-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
}

// Postar story com filtro
async function postStoryWithFilter() {
    if (!window.currentStoryFile) return;
    
    try {
        showLoading(document.body);
        
        // Aplicar filtro à imagem antes do upload
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = async () => {
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Aplicar filtros CSS equivalentes no canvas
            const filter = window.currentStoryFilter || 'none';
            ctx.filter = getCanvasFilter(filter);
            ctx.drawImage(img, 0, 0);
            
            // Converter para blob
            canvas.toBlob(async (blob) => {
                // Upload para Supabase Storage
                const fileExt = window.currentStoryFile.name.split('.').pop();
                const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                    .from(STORIES_BUCKET)
                    .upload(fileName, blob);
                    
                if (uploadError) throw uploadError;
                
                // Obter URL pública
                const { data: urlData } = window.supabaseClient.storage
                    .from(STORIES_BUCKET)
                    .getPublicUrl(fileName);
                    
                // Salvar no banco de dados
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24h
                
                const { data: storyData, error: storyError } = await window.supabaseClient
                    .from('stories')
                    .insert({
                        user_id: currentUser.id,
                        media_url: urlData.publicUrl,
                        media_type: 'image',
                        expires_at: expiresAt.toISOString()
                    })
                    .select()
                    .single();
                    
                if (storyError) throw storyError;
                
                // Atualizar UI - mostrar story ativo com borda verde neon
                updateUserStoryUI(true);
                
                showUploadFeedback('Story postado com sucesso!', 'success');
                closeStoryFiltersModal();
                hideLoading();
            }, 'image/jpeg', 0.9);
        };
        
        img.src = document.getElementById('story-preview').src;
        
    } catch (error) {
        console.error('Erro ao postar story:', error);
        showUploadFeedback('Erro ao postar story. Tente novamente.', 'error');
        hideLoading();
    }
}

// Converter filtro CSS para filtro Canvas
function getCanvasFilter(filterType) {
    const filters = {
        'none': 'none',
        'grayscale': 'grayscale(100%)',
        'sepia': 'sepia(100%)',
        'blur': 'blur(2px)',
        'brightness': 'brightness(1.3)',
        'contrast': 'contrast(1.5)',
        'hue-rotate': 'hue-rotate(90deg)',
        'saturate': 'saturate(2)'
    };
    
    return filters[filterType] || 'none';
}

// Atualizar UI do story do usuário
function updateUserStoryUI(hasActiveStory) {
    const userStoryItem = document.querySelector('.user-story');
    const addBtn = userStoryItem?.querySelector('.story-add-btn');
    const storyCircle = userStoryItem?.querySelector('.story-circle');
    
    if (hasActiveStory) {
        // Mostrar círculo com story
        storyCircle.style.display = 'flex';
        userStoryItem?.classList.add('has-story');
        
        // Sempre mostrar o botão + mesmo com story ativo
        addBtn.style.display = 'flex';
        addBtn.textContent = '+';
        
        // Habilitar clique no círculo para visualizar story
        storyCircle.style.cursor = 'pointer';
        storyCircle.onclick = viewOwnStories;
    } else {
        // Esconder círculo completamente quando não tem story
        storyCircle.style.display = 'none';
        userStoryItem?.classList.remove('has-story');
        
        // Manter apenas o botão + visível
        addBtn.style.display = 'flex';
        addBtn.textContent = '+';
        
        // Desabilitar clique no círculo quando não tem story
        storyCircle.style.cursor = 'default';
        storyCircle.onclick = null;
    }
}

// Abrir modal de visualização de story
async function openStoryModal(mediaUrl, storyIndex = 0, allStories = []) {
    const modal = document.getElementById('story-modal');
    const mediaElement = document.getElementById('story-media');
    const progressFill = modal.querySelector('.story-progress-fill');
    const counterDots = document.getElementById('storyCounterDots');
    
    // Configurar mídia
    mediaElement.src = mediaUrl;
    
    // Gerar contador de stories (simulado com 20 stories máximos)
    const totalStories = allStories.length > 0 ? allStories.length : 1;
    counterDots.innerHTML = '';
    
    for (let i = 0; i < Math.min(totalStories, 20); i++) {
        const dot = document.createElement('div');
        dot.className = 'story-counter-dot';
        if (i < storyIndex) {
            dot.classList.add('viewed');
        } else if (i === storyIndex) {
            dot.classList.add('current');
        }
        dot.onclick = () => navigateToStory(i);
        counterDots.appendChild(dot);
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Iniciar barra de progresso (5 segundos)
    let progress = 0;
    if (storyProgressInterval) {
        clearInterval(storyProgressInterval);
    }
    
    storyProgressInterval = setInterval(() => {
        progress += 2; // 2% a cada 100ms = 5 segundos total
        progressFill.style.width = `${progress}%`;
        
        if (progress >= 100) {
            // Marcar como visualizado e ir para próximo
            markStoryAsViewed(storyIndex);
            
            if (storyIndex < totalStories - 1) {
                // Ir para próximo story
                navigateToStory(storyIndex + 1);
            } else {
                closeStoryModal();
            }
        }
    }, 100);
    
    // Salvar estado atual
    window.currentStoryState = {
        currentIndex: storyIndex,
        allStories: allStories
    };
    
    // Atualizar botões de navegação
    updateNavigationButtons();
}

// Navegar para story específico
function navigateToStory(index) {
    const state = window.currentStoryState;
    if (!state || !state.allStories[index]) return;
    
    // Limpar intervalo anterior
    if (storyProgressInterval) {
        clearInterval(storyProgressInterval);
    }
    
    // Abrir story específico
    openStoryModal(state.allStories[index].media_url, index, state.allStories);
}

// Marcar story como visualizado
function markStoryAsViewed(index) {
    const dots = document.querySelectorAll('.story-counter-dot');
    if (dots[index]) {
        dots[index].classList.remove('current');
        dots[index].classList.add('viewed');
    }
}

// Navegar para story anterior
function navigatePrevStory() {
    const state = window.currentStoryState;
    if (!state) return;
    
    if (state.currentIndex > 0) {
        navigateToStory(state.currentIndex - 1);
    }
}

// Navegar para próximo story
function navigateNextStory() {
    const state = window.currentStoryState;
    if (!state) return;
    
    if (state.currentIndex < state.allStories.length - 1) {
        navigateToStory(state.currentIndex + 1);
    }
}

// Excluir story atual sendo visualizado
async function deleteCurrentViewingStory() {
    if (!confirm('Tem certeza que deseja excluir este story?')) {
        return;
    }
    
    const state = window.currentStoryState;
    if (!state || !state.allStories[state.currentIndex]) {
        showUploadFeedback('Nenhum story para excluir.', 'error');
        return;
    }
    
    try {
        showLoading(document.body);
        
        const currentStory = state.allStories[state.currentIndex];
        
        // Excluir do banco de dados
        const { error: deleteError } = await window.supabaseClient
            .from('stories')
            .delete()
            .eq('id', currentStory.id);
            
        if (deleteError) throw deleteError;
        
        // Excluir arquivo do storage
        const fileName = currentStory.media_url.split('/').pop();
        await window.supabaseClient.storage
            .from(STORIES_BUCKET)
            .remove([fileName]);
        
        // Remover story da lista local
        state.allStories.splice(state.currentIndex, 1);
        
        // Forçar refresh do cache do Supabase
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificar se ainda há stories
        const remainingStories = await getAllUserStories();
        
        if (remainingStories.length === 0) {
            // Não há mais stories
            closeStoryModal();
            updateUserStoryUI(false);
            showUploadFeedback('Story excluído com sucesso!', 'success');
        } else if (state.currentIndex >= state.allStories.length) {
            // Se excluiu o último, voltar para o penúltimo
            navigateToStory(state.allStories.length - 1);
        } else {
            // Continuar no mesmo índice (próximo story)
            navigateToStory(state.currentIndex);
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Erro ao excluir story:', error);
        showUploadFeedback('Erro ao excluir story. Tente novamente.', 'error');
        hideLoading();
    }
}

// Atualizar estado dos botões de navegação
function updateNavigationButtons() {
    const state = window.currentStoryState;
    if (!state) return;
    
    const prevBtn = document.querySelector('.story-nav-prev');
    const nextBtn = document.querySelector('.story-nav-next');
    
    // Botão anterior
    if (state.currentIndex === 0) {
        prevBtn.classList.add('disabled');
    } else {
        prevBtn.classList.remove('disabled');
    }
    
    // Botão próximo
    if (state.currentIndex === state.allStories.length - 1) {
        nextBtn.classList.add('disabled');
    } else {
        nextBtn.classList.remove('disabled');
    }
}

// Fechar modal de story
function closeStoryModal() {
    const modal = document.getElementById('story-modal');
    modal.style.display = 'none';
    
    // Limpar intervalo
    if (storyProgressInterval) {
        clearInterval(storyProgressInterval);
        storyProgressInterval = null;
    }
    
    // Limpar estado
    window.currentStoryState = null;
}

// Configurar navegação por teclado e swipe
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('story-modal');
    if (modal.style.display === 'flex' && window.currentStoryState) {
        switch(e.key) {
            case 'ArrowRight':
                navigateNextStory();
                break;
            case 'ArrowLeft':
                navigatePrevStory();
                break;
            case 'Escape':
                closeStoryModal();
                break;
        }
    }
});

// Configurar navegação por swipe (touch)
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    const modal = document.getElementById('story-modal');
    if (modal.style.display === 'flex') {
        touchStartX = e.changedTouches[0].screenX;
    }
});

document.addEventListener('touchend', (e) => {
    const modal = document.getElementById('story-modal');
    if (modal.style.display === 'flex' && window.currentStoryState) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe left - próximo story
            navigateNextStory();
        } else if (diff < 0) {
            // Swipe right - story anterior
            navigatePrevStory();
        }
    }
}

// Funções do story do usuário
async function checkUserHasActiveStory() {
    try {
        // Forçar refresh do cache do Supabase
        const { data, error } = await window.supabaseClient
            .from('stories')
            .select('id, media_url, expires_at, created_at')
            .eq('user_id', currentUser.id)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Erro ao verificar story ativo:', error);
        return null;
    }
}

// Buscar todos os stories do usuário (sem cache)
async function getAllUserStories() {
    try {
        const { data, error } = await window.supabaseClient
            .from('stories')
            .select('*')
            .eq('user_id', currentUser.id)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar stories:', error);
        return [];
    }
}
