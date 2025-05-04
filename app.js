async function uploadVideo() {
    const file = document.getElementById("videoInput").files[0];
    const note = document.getElementById("videoNote").value;
    if (!file) return alert("영상을 선택하세요.");
  
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session.user.id;
    const filePath = `${uid}/${Date.now()}_${file.name}`;
  
    const { error: uploadError } = await supabase.storage
      .from("workout-videos")
      .upload(filePath, file, { upsert: true });
  
    if (uploadError) {
      alert("업로드 실패: " + uploadError.message);
      return;
    }
  
    const { data: publicUrlData } = supabase.storage
      .from("workout-videos")
      .getPublicUrl(filePath);
  
    const url = publicUrlData.publicUrl;
  
    const { error: insertError } = await supabase.from("videos").insert([
      { uid, url, note }
    ]);
  
    if (insertError) {
      alert("DB 저장 실패: " + insertError.message);
      return;
    }
  
    alert("업로드 성공!");
    loadAllVideos();
  }
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
      videoDiv.innerHTML = `
        <video src="${video.url}" controls width="300"></video>
        <p><strong>메모:</strong> ${video.note || "없음"}</p>
        <div id="comments-${video.id}"></div>
        <input type="text" placeholder="댓글 작성" id="comment-input-${video.id}">
        <button onclick="postComment(${video.id})">댓글 달기</button>
        <hr>
      `;
      container.appendChild(videoDiv);
  
      await loadComments(video.id);
    }
  }
  async function loadComments(videoId) {
    const { data: comments } = await supabase
      .from("comments")
      .select("content, created_at")
      .eq("video_id", videoId)
      .order("created_at", { ascending: true });
  
    const commentDiv = document.getElementById(`comments-${videoId}`);
    commentDiv.innerHTML = "<p><strong>댓글:</strong></p>";
  
    comments.forEach(c => {
      const p = document.createElement("p");
      p.textContent = `- ${c.content}`;
      commentDiv.appendChild(p);
    });
  }
  
  async function postComment(videoId) {
    const input = document.getElementById(`comment-input-${videoId}`);
    const content = input.value.trim();
    if (!content) return;
  
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session.user.id;
  
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
  document.addEventListener("DOMContentLoaded", () => {
    loadAllVideos();
  });
   