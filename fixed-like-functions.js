// Funções JavaScript corrigidas para persistência real de likes

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
            post.likes_count = result.total_likes;
        }
        
        // Re-renderizar posts para atualizar UI
        await renderPosts();
        
    } catch (error) {
        console.error('Erro ao fazer toggle like:', error);
        alert('Erro ao curtir/descurtir post. Tente novamente.');
    }
}

// Carregar posts com contagem real do banco
async function loadPosts(reset = false) {
    if (isLoading) return;
    
    try {
        isLoading = true;
        if (reset) {
            currentPage = 1;
            posts = [];
        }
        
        showLoading(postsFeed);
        
        const { data, error } = await window.supabaseClient
            .from('posts')
            .select(`
                *,
                profiles: user_id (
                    id,
                    nome,
                    avatar_url
                )
            `)
            .order('created_at', { ascending: false })
            .range((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE - 1);

        if (error) throw error;

        posts = reset ? data : [...posts, ...data];
        
        // Carregar likes do usuário
        await loadUserLikes();
        
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

// Carregar likes do usuário usando RPC function
async function loadUserLikes() {
    try {
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
    
    // Carregar informações de quem curtiu para posts com likes
    for (const post of posts) {
        if (post.likes_count > 0) {
            await loadLikesInfo(post.id);
        }
    }
}

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
            const post = posts.find(p => p.id === postId);
            const otherCount = Math.max(0, (post?.likes_count || 0) - 1);
            
            likesInfo.innerHTML = `
                <div class="likes-info-content">
                    <img src="${latestLike.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect width=\'24\' height=\'24\' fill=\'%2339FF14\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\' font-size=\'12\'%3E?%3C/text%3E%3C/svg%3E'}" alt="Avatar" class="likes-avatar">
                    <span class="likes-text">
                        <strong>${latestLike.nome}</strong> e mais ${otherCount} ${otherCount === 1 ? 'pessoa' : 'pessoas'} curtiram isso
                    </span>
                </div>
            `;
            likesInfo.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao carregar informações de likes:', error);
    }
}

// Criar HTML do post com contagem real
function createPostHTML(post) {
    const profile = post.profiles;
    const isOwner = profile?.id === currentUser?.id;
    const isLiked = userLikes.has(post.id);
    
    const mediaHTML = post.media_url ? (post.media_type === 'video' 
        ? `<div class="post-media"><video controls><source src="${post.media_url}" type="video/mp4"></video></div>`
        : `<div class="post-media"><img src="${post.media_url}" alt="Post"></div>`) : '';
    
    return `
        <div class="post-card glass" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${profile?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Crect width=\'40\' height=\'40\' fill=\'%2339FF14\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\' font-size=\'20\'%3E?%3C/text%3E%3C/svg%3E'}" alt="Avatar" class="post-avatar">
                <div class="post-info">
                    <span class="post-name">${profile?.nome || 'Usuário'}</span>
                    <span class="post-time">${formatTimeAgo(post.created_at)}</span>
                </div>
                ${!isOwner ? `<button class="report-post-btn" onclick="openReportModal('${post.id}', 'post')" title="Denunciar post">
                    <svg class="report-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                </button>` : `<button class="delete-post-btn" onclick="deletePost('${post.id}')" title="Excluir post">
                    <svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 6h18v2H3V6zm0 5h14v2H3v-2zm0 5h10v2H3v-2z"/>
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
                    <span>${post.likes_count || 0}</span>
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
