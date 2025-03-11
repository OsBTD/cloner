const feedElement = document.getElementById('feed');
const loadMoreButton = document.getElementById('load-more');
const loadingElement = document.getElementById('loading');
const postTypeSelect = document.getElementById('post-type');
const refreshButton = document.getElementById('refresh-button');
const newPostsCount = document.getElementById('new-posts-count');
const updateTimeElement = document.getElementById('update-time');
const modal = document.getElementById('post-details-modal');
const closeModalBtn = document.querySelector('.close');

let currentOffset = 0;
const sizePage = 20;
let [postStoryIds, postJobIds, postTopIds, postBestIds, postAskIds, postShowIds, postPollIds, idsToDisplay] = [[], [], [], [], [], [], [], []];
let selectedType = 'topstories';
let maxItemId = null;
let newPostsAvailable = 0;

async function fetchItems(type) {
  const response = await fetch(`https://hacker-news.firebaseio.com/v0/${type}.json`);
  if (!response.ok) throw new Error(`Failed to fetch ${type}`);
  return await response.json();
}

async function fetchItemDetails(itemId) {
  const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${itemId}.json`);
  if (!response.ok) throw new Error(`Failed to fetch item ${itemId}`);
  return await response.json();
}

function renderPost(post) {
  if (!post) return null;

  const postElement = document.createElement('div');
  postElement.className = 'post';

  const postDate = new Date(post.time * 1000);
  const formattedDate = postDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const displayType = selectedType === 'polls' ? 'poll' : post.type;
  const postTypeClass = displayType ? `type-${displayType}` : '';

  postElement.innerHTML = `
    <h3>
      ${post.url ? `<a href="${post.url}" target="_blank" rel="noopener noreferrer">` : ''}
      ${post.title || 'No Title'}
      ${post.url ? '</a>' : ''}
      <span class="post-type-indicator ${postTypeClass}">${displayType || 'unknown'}</span>
    </h3>
    <div class="post-meta">
      <span>By: ${post.by || 'Anonymous'}</span>
      <span>Posted: ${formattedDate}</span>
      <span>Score: ${post.score || 0}</span>
      <span>Comments: ${post.descendants || 0}</span>
    </div>
    ${post.text && !post.url ? `<div class="post-text">${post.text}</div>` : ''}
    <button class="view-comments" data-id="${post.id}">View Discussion</button>
  `;

  return postElement;
}

async function renderComments(commentIds, container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading comments...</p></div>';

  if (!commentIds || commentIds.length === 0) {
    container.innerHTML = '<p>No comments yet.</p>';
    return;
  }

  container.innerHTML = '';
  for (const id of commentIds) {
    const comment = await fetchItemDetails(id);
    if (!comment || comment.deleted) continue;

    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.innerHTML = `
      <strong>${comment.by || 'Anonymous'}</strong>
      <div>${comment.text || 'No content'}</div>
    `;
    container.appendChild(commentElement);
  }
}

async function loadPosts(type) {
  loadingElement.style.display = 'flex';
  loadMoreButton.disabled = true;

  try {
    if (currentOffset === 0) {
      const storyIds = await fetchItems('newstories');
      const jobIds = await fetchItems('jobstories');
      const topIds = await fetchItems('topstories');
      const bestIds = await fetchItems('beststories');
      const askIds = await fetchItems('askstories');
      const showIds = await fetchItems('showstories');
      postStoryIds = [...storyIds];
      postJobIds = [...jobIds];
      postTopIds = [...topIds];
      postBestIds = [...bestIds];
      postAskIds = [...askIds];
      postShowIds = [...showIds];
      postPollIds = [...topIds];

      switch (type) {
        case 'newstories':
          const storyItems = await Promise.all(storyIds.slice(0, 100).map(fetchItemDetails)); // Limit to first 100 for speed
          idsToDisplay = storyItems
            .filter(item => item && !(item.text && !item.url))
            .map(item => item.id);
          break;
        case 'jobstories':
          idsToDisplay = postJobIds;
          break;
        case 'topstories':
          idsToDisplay = postTopIds;
          break;
        case 'beststories':
          idsToDisplay = postBestIds;
          break;
        case 'askstories':
          idsToDisplay = postAskIds;
          break;
        case 'showstories':
          idsToDisplay = postShowIds;
          break;
        case 'polls':
          idsToDisplay = postPollIds; 
          break;
      }
    }

    const newPosts = await Promise.all(
      idsToDisplay.slice(currentOffset, currentOffset + sizePage).map(fetchItemDetails)
    );

    const postsFragment = document.createDocumentFragment();
    newPosts.forEach(post => {
      if (post) {
        const postElement = renderPost(post);
        if (postElement) postsFragment.appendChild(postElement);
      }
    });
    feedElement.appendChild(postsFragment);

    currentOffset += sizePage;
    loadMoreButton.style.display = currentOffset >= idsToDisplay.length ? 'none' : 'block';
  } catch (error) {
    console.error('Error loading posts:', error);
    feedElement.innerHTML = '<p>Error loading posts.</p>';
  } finally {
    loadingElement.style.display = 'none';
    loadMoreButton.disabled = false;
  }
}

async function checkForNewPosts() {
  try {
    const latestMaxId = await fetchItems('maxitem');
    if (maxItemId === null) {
      maxItemId = latestMaxId;
      return;
    }

    if (latestMaxId > maxItemId) {
      const newPosts = [];
      const startId = Math.max(maxItemId + 1, latestMaxId - 10);
      for (let id = latestMaxId; id >= startId; id--) {
        const post = await fetchItemDetails(id);
        if (post && (post.type === 'story' || post.type === 'job' || post.type === 'poll')) {
          newPosts.push(post);
        }
      }
      maxItemId = latestMaxId;
      newPostsAvailable += newPosts.length;
      newPostsCount.textContent = newPostsAvailable;
      if (newPosts.length > 0) updateLiveData(newPosts[0]);
    }
  } catch (error) {
    console.error('Error checking for new posts:', error);
  }
}

function updateLiveData(post) {
  if (!post) return;

  const postDate = new Date(post.time * 1000);
  const formattedDate = postDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  document.getElementById('latest-item').innerHTML = `
    <h4>${post.title || 'New Item'}</h4>
    <div class="post-meta">
      <span>Type: ${post.type || 'unknown'}</span>
      <span>By: ${post.by || 'Anonymous'}</span>
      <span>Posted: ${formattedDate}</span>
    </div>
    ${post.text ? `<div class="post-text">${post.text.slice(0, 150)}${post.text.length > 150 ? '...' : ''}</div>` : ''}
  `;
  updateTimeElement.textContent = new Date().toLocaleTimeString();
}

async function openPostDetails(postId) {
  const post = await fetchItemDetails(postId);
  if (!post) return;

  document.getElementById('post-title').textContent = post.title || 'No Title';
  document.getElementById('post-author').textContent = post.by || 'Anonymous';
  document.getElementById('post-score').textContent = post.score || '0';

  const postLink = document.getElementById('post-link');
  if (post.url) {
    postLink.href = post.url;
    postLink.style.display = 'inline';
  } else {
    postLink.style.display = 'none';
  }

  const commentsContainer = document.getElementById('comments-list');
  modal.style.display = 'block';
  await renderComments(post.kids || [], commentsContainer);
}

postTypeSelect.addEventListener('change', (event) => {
  selectedType = event.target.value;
  currentOffset = 0;
  feedElement.innerHTML = '';
  loadPosts(selectedType);
});

loadMoreButton.addEventListener('click', () => loadPosts(selectedType));

refreshButton.addEventListener('click', async () => {
  currentOffset = 0;
  feedElement.innerHTML = '';
  newPostsAvailable = 0;
  newPostsCount.textContent = '0';
  await loadPosts(selectedType);
});

feedElement.addEventListener('click', (event) => {
  if (event.target.classList.contains('view-comments')) {
    const postId = event.target.getAttribute('data-id');
    openPostDetails(postId);
  }
});

closeModalBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target === modal) modal.style.display = 'none';
});

async function init() {
  await loadPosts(selectedType);
  setInterval(checkForNewPosts, 5000);
}

init();