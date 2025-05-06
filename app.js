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
  
    videoDiv.innerHTML = `
  <video src="${video.url}" controls width="300" class="rounded shadow"></video>
  <p><strong>메모:</strong> ${video.note || "없음"}</p>
  ${
    video.uid === currentUid
      ? `<button onclick="deleteVideo('${video.id}', '${video.url}')" class='bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600'>영상 삭제</button>`
      : ""
  }
  <div id="comments-${video.id}" class="mt-2"></div>
  <input type="text" placeholder="댓글 작성" id="comment-input-${video.id}" class="p-1 border rounded w-full" />
  <button onclick="postComment('${video.id}')" class="mt-1 bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">댓글 달기</button>
`;


    container.appendChild(videoDiv);
    await loadComments(video.id);
  }
  
}

// ✅ 댓글 불러오기
async function loadComments(videoId) {
  const { data: comments,error } = await supabase
    .from("comments")
    .select("id, uid, content, created_at")
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

    const p = document.createElement("p");
    p.textContent = `- ${comment.content}`;
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
document.addEventListener("DOMContentLoaded", checkLoginStatus);

// ✅ 전역 등록
window.uploadVideo = uploadVideo;



   