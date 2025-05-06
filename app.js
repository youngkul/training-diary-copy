import { supabase } from "./supabase-config.js";
import { getSession } from "./auth.js";


// ✅ 영상 업로드
async function uploadVideo() {
  const file = document.getElementById("videoInput").files[0];
  const note = document.getElementById("videoNote").value;
  if (!file) return alert("영상을 선택하세요.");

  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) {
    alert("로그인이 필요합니다.");
    return;
  }

  const extension = file.name.split('.').pop();
  const timestamp = Date.now();
  const safeFileName = `${timestamp}.${extension}`;
  const filePath = `${uid}/${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("training-diary")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    alert("업로드 실패: " + uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from("training-diary")
    .getPublicUrl(filePath);
  const url = publicUrlData.publicUrl;

  const { error: insertError } = await supabase.from("videos").insert([
    { url, note, uid }
  ]);

  if (insertError) {
    alert("DB 저장 실패: " + insertError.message);
    return;
  }

  alert("업로드 성공!");
  loadAllVideos();
}

// ✅ 영상 삭제
window.deleteVideo = async function (videoId, videoUrl) {
    const confirmDelete = confirm("정말 이 영상을 삭제하시겠습니까?");
    if (!confirmDelete) return;
  
    const session = await getSession();
    const uid = session?.user?.id;
    if (!uid) {
      alert("로그인이 필요합니다.");
      return;
    }
  
    // ✅ 영상 삭제 전에 관련 좋아요 먼저 삭제
    const { error: likeDeleteError } = await supabase
      .from("likes")
      .delete()
      .eq("video_id", videoId);
  
    if (likeDeleteError) {
      console.error("좋아요 삭제 실패:", likeDeleteError);
      alert("삭제 실패 (좋아요)");
      return;
    }
  
    const filePath = videoUrl.split("/").slice(-2).join("/");
  
    const { error: fileError } = await supabase.storage
      .from("training-diary")
      .remove([filePath]);
  
    const { error: dbError } = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId)
      .eq("uid", uid); // 본인만 삭제 가능
  
    if (fileError || dbError) {
      console.error("삭제 오류:", fileError || dbError);
      alert("삭제 실패");
      return;
    }
  
    alert("삭제 완료");
    loadAllVideos();
  };
  

// ✅ 전체 영상 불러오기
async function loadAllVideos() {
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, uid, url, note, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("영상 로드 실패:", error.message);
    return;
  }

  const session = await getSession();
  const currentUid = session?.user?.id;
  const container = document.getElementById("videoFeed");
  container.innerHTML = "";

  for (const video of videos) {
    const videoDiv = document.createElement("div");
    videoDiv.classList.add("space-y-2", "border-b", "pb-4");

    const dateStr = new Date(video.created_at).toLocaleDateString("ko-KR");

// 영상 목록 반복문 안에서
videoDiv.innerHTML = `
  <div class="bg-white rounded-2xl shadow-lg p-5 space-y-4">
    <p class="text-sm text-gray-500">
  ${timeAgo(video.created_at)}에 업로드됨
</p>



    <video 
  src="${video.url}" 
  controls 
  preload="metadata" 
  playsinline 
  muted 
  class="w-full aspect-video rounded-xl shadow-lg border border-gray-200">
</video>

<p class="mt-2 font-medium text-gray-800"><strong>메모:</strong> 
  <span id="note-${video.id}">${video.note || "없음"}</span>
</p>

<input type="text" id="edit-note-${video.id}" placeholder="메모 수정" 
  class="p-2 mt-1 w-full border rounded" />

<!-- 버튼 3개를 한 줄에 정렬 -->
<div class="flex flex-wrap gap-2 mt-2 items-center">
  <button onclick="updateNote('${video.id}')" 
    class="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">
    메모 저장
  </button>
  <button onclick="deleteNote('${video.id}')" 
    class="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700">
    메모 삭제
  </button>
  <button onclick="deleteVideo('${video.id}', '${video.url}')" 
    class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
    영상 삭제
  </button>
</div>

<!-- 좋아요 줄을 따로 분리 -->
<div class="flex items-center space-x-2 mt-2">
  <button onclick="toggleLike('${video.id}')" id="like-btn-${video.id}" class="text-red-500 text-xl">❤️</button>
  <span id="like-count-${video.id}" class="text-sm">0</span><span class="text-sm">명이 좋아요</span>
</div>

<!-- 댓글 영역 -->
<div id="comments-${video.id}" class="mt-4 text-sm text-gray-700"></div>
<input type="text" placeholder="댓글 작성" id="comment-input-${video.id}" 
  class="p-2 mt-2 w-full border rounded" />
<button onclick="postComment('${video.id}')" 
  class="mt-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
  댓글 달기
</button>

`;

    container.appendChild(videoDiv);
    await loadComments(video.id);
    await loadLikes(video.id); 
  }
  
}

// ✅ 댓글 불러오기
async function loadComments(videoId) {
    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        id,
        uid,
        content,
        created_at,
        users:uid (
          user_metadata
        )
      `)
      .eq("video_id", videoId)
      .order("created_at", { ascending: true });
  
    if (error) {
      console.error("댓글 불러오기 오류:", error.message);
      return;
    }
  
    if (!comments) {
      console.warn("댓글이 없습니다 또는 불러오기 실패");
      return;
    }
  
    const session = await getSession();
    const currentUid = session?.user?.id;
  
    const commentDiv = document.getElementById(`comments-${videoId}`);
    commentDiv.innerHTML = "<p class='font-semibold'>댓글:</p>";
  
    comments.forEach(comment => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("flex", "justify-between", "items-center");
  
      const name = comment.users?.user_metadata?.full_name || "익명";
  
      const p = document.createElement("p");
      p.innerHTML = `<strong class="text-blue-500">${name}</strong>: ${comment.content}`;
      wrapper.appendChild(p);
  
      if (comment.uid === currentUid) {
        const btn = document.createElement("button");
        btn.textContent = "삭제";
        btn.className = "text-sm text-red-500 ml-2";
        btn.onclick = () => deleteComment(videoId, comment.id);
        wrapper.appendChild(btn);
      }
  
      commentDiv.appendChild(wrapper);
    });
  }
  
function timeAgo(dateString) {
    const now = new Date();
    const uploaded = new Date(dateString);
    const diff = (now - uploaded) / 1000; // 초 단위
  
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  }
  
// ✅ 댓글 작성
window.postComment = async function (videoId) {
  const input = document.getElementById(`comment-input-${videoId}`);
  const content = input.value.trim();
  if (!content) return;

  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) {
    alert("로그인이 필요합니다.");
    return;
  }

  const { error } = await supabase.from("comments").insert([
    { video_id: videoId, uid, content }
  ]);

  if (error) {
    alert("댓글 실패: " + error.message);
    return;
  }

  input.value = "";
  loadComments(videoId);
};

// ✅ 댓글 삭제
window.deleteComment = async function (videoId, commentId) {
  const confirmDelete = confirm("댓글을 삭제하시겠습니까?");
  if (!confirmDelete) return;

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    alert("댓글 삭제 실패: " + error.message);
    return;
  }

  loadComments(videoId);
};

// ✅ 로그인 상태 확인 및 UI 전환
async function checkLoginStatus() {
  const session = await getSession();
  const authDiv = document.getElementById("authSection");
  const mainDiv = document.getElementById("mainSection");
  const userInfo = document.getElementById("userInfo");

  if (session) {
    authDiv.classList.add("hidden");
    mainDiv.classList.remove("hidden");
    userInfo.innerText = `로그인됨: ${session.user.email}`;
    loadAllVideos();
  } else {
    authDiv.classList.remove("hidden");
    mainDiv.classList.add("hidden");
  }
}

// ✅ 페이지 로딩 시 실행
// ✅ 페이지 로딩 시 실행
document.addEventListener("DOMContentLoaded", checkLoginStatus);

// ✅ 전역 등록
window.uploadVideo = uploadVideo;

window.updateNote = async function(videoId) {
  const input = document.getElementById(`edit-note-${videoId}`);
  const newNote = input.value.trim();
  if (!newNote) {
    alert("메모 내용을 입력해주세요.");
    return;
  }

  const { error } = await supabase
    .from("videos")
    .update({ note: newNote })
    .eq("id", videoId);

  if (error) {
    alert("메모 업데이트 실패: " + error.message);
    return;
  }

  document.getElementById(`note-${videoId}`).textContent = newNote;
  input.value = "";
  alert("메모가 저장되었습니다!");
};
window.deleteNote = async function(videoId) {
    const confirmDelete = confirm("정말 메모를 삭제하시겠습니까?");
    if (!confirmDelete) return;
  
    const { error } = await supabase
      .from("videos")
      .update({ note: "" })
      .eq("id", videoId);
  
    if (error) {
      alert("메모 삭제 실패: " + error.message);
      return;
    }
  
    document.getElementById(`note-${videoId}`).textContent = "없음";
    document.getElementById(`edit-note-${videoId}`).value = "";
    alert("메모가 삭제되었습니다.");
  };
  async function loadLikes(videoId) {
    const session = await getSession();
    const uid = session?.user?.id;
  
    const { data: likes, error } = await supabase
      .from("likes")
      .select("id, uid, video_id")
      .eq("video_id", videoId);
  
    if (error) {
      console.error("좋아요 로드 실패:", error.message);
      return;
    }
  
    const count = likes.length;
    const likeCountEl = document.getElementById(`like-count-${videoId}`);
    const likeBtn = document.getElementById(`like-btn-${videoId}`);
    likeCountEl.textContent = count;
  
    // 유저가 이미 좋아요 눌렀는지 확인
    const liked = likes.some(like => like.uid === uid);
    likeBtn.textContent = liked ? "❤️" : "🤍";
  }
  window.toggleLike = async function (videoId) {
    const session = await getSession();
    const uid = session?.user?.id;
    if (!uid) {
      alert("로그인이 필요합니다.");
      return;
    }
  
    // 이미 좋아요 눌렀는지 확인
    const { data: existingLike, error: checkError } = await supabase
    .from("likes")
    .select("id")
    .eq("video_id", videoId)
    .eq("uid", uid)
    .maybeSingle();

    if (checkError) {
    console.error("좋아요 확인 실패:", checkError.message);
    return;
    }

  
    if (existingLike) {
        // 좋아요 삭제
        const { error: deleteError } = await supabase
          .from("likes")
          .delete()
          .eq("id", existingLike.id);
      
        if (deleteError) {
          console.error("좋아요 삭제 실패:", deleteError.message);
          return;
        }
      } else {
        // 좋아요 추가
        const { error: insertError } = await supabase
          .from("likes")
          .insert([{ uid, video_id: videoId }]);
      
        if (insertError) {
          console.error("좋아요 추가 실패:", insertError.message);
          return;
        }
      }
      
      // 다시 로드
      await loadLikes(videoId);
      
  };
    
  


   