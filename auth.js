import { supabase } from "./supabase-config.js";

// 회원가입
export async function signup(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.error("회원가입 오류:", error.message);
    alert("회원가입 실패: " + error.message);
    return null;
  }
  return data;
}

// 로그인
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("로그인 오류:", error.message);
    alert("로그인 실패: " + error.message);
    return null;
  }
  return data;
}

// 로그아웃
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("로그아웃 오류:", error.message);
    alert("로그아웃 실패: " + error.message);
  } else {
    alert("로그아웃 되었습니다.");
    location.reload();
  }
}

// 세션 확인
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("세션 확인 오류:", error.message);
    return null;
  }
  return session;
}
// HTML 버튼에서 직접 호출할 수 있도록 window에 연결
window.handleSignup = async function () {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;
    await signup(email, password);
  };
  
  window.handleLogin = async function () {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;
    const session = await login(email, password);
    if (session) location.reload();
  };
  
  window.handleLogout = async function () {
    await logout();
  };
  
