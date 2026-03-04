<script>
  document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (email === "user@example.com" && password === "password123") {
      localStorage.setItem("userType", "user");
      window.location.href = "home.html";
    } else {
      alert("ACCESS DENIED");
    }
  });

  function guestLogin() {
    localStorage.setItem("userType", "guest");
    window.location.href = "home.html";
  }
</script>
