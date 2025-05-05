import { getSession } from "./auth.js";
import { supabase } from "./supabase-config.js";

// ✅ 영상 업로드
async function uploadVideo() {
  const file = document.getElementById("videoInput").files[0];
  const note = document.getElementById("videoNote").value;
  if (!file) return alert("영상을 선택하세요.");

  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) {
    alert("로그인되어 있지 않습니다.");
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

  // ✅ 로그인 사용자 정보 가져오기
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    alert("로그인 정보 확인 실패");
    return;
  }
  const { error: insertError } = await supabase.from("videos").insert([
    { uid: user.id, url, note }
  ]);

  if (insertError) {
    alert("DB 저장 실패: " + insertError.message);
    return;
  }

  alert("업로드 성공!");
  loadAllVideos();
}

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

  const container = document.getElementById("videoFeed");
  container.innerHTML = "";

  for (const video of videos) {
    const videoDiv = document.createElement("div");
    videoDiv.classList.add("space-y-2");

    videoDiv.innerHTML = `
      <video src="${video.url}" controls width="300" class="rounded shadow"></video>
      <p><strong>메모:</strong> ${video.note || "없음"}</p>
      <div id="comments-${video.id}"></div>
      <input type="text" placeholder="댓글 작성" id="comment-input-${video.id}" class="p-1 border rounded w-full" />
      <button onclick="postComment(${video.id})" class="mt-1 bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">댓글 달기</button>
      <hr>
    `;
    container.appendChild(videoDiv);

    await loadComments(video.id);
  }
}

// ✅ 댓글 불러오기
async function loadComments(videoId) {
  const { data: comments } = await supabase
    .from("comments")
    .select("content, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: true });

  const commentDiv = document.getElementById(`comments-${videoId}`);
  commentDiv.innerHTML = "<p class='font-semibold'>댓글:</p>";

  comments.forEach(c => {
    const p = document.createElement("p");
    p.textContent = `- ${c.content}`;
    commentDiv.appendChild(p);
  });
}

// ✅ 댓글 작성
async function postComment(videoId) {
  const input = document.getElementById(`comment-input-${videoId}`);
  const content = input.value.trim();
  if (!content) return;

  const session = await getSession();
  const uid = session?.user?.id;
  console.log("세션에서 가져온 uid:", uid);
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
}

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
window.postComment = postComment;


   