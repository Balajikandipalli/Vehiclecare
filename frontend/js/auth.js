const API_URL = "http://127.0.0.1:5000";


// REGISTER
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const message = document.getElementById("message");

        const data = {
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            phone: document.getElementById("phone").value,
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch(
                `${API_URL}/api/auth/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data)
                }
            );

            const result = await response.json();

            if (response.ok) {

                message.textContent =
                    "Registration successful! Redirecting...";

                message.style.color = "green";

                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1500);

            } else {

                message.textContent = result.message;
                message.style.color = "red";
            }

        } catch (error) {

            message.textContent =
                "Unable to connect to server.";

            message.style.color = "red";

            console.error(error);
        }
    });
}


// LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const message = document.getElementById("message");

        const data = {
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch(
                `${API_URL}/api/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data)
                }
            );

            const result = await response.json();

            if (response.ok) {

                localStorage.setItem(
                    "token",
                    result.token
                );

                localStorage.setItem(
                    "user",
                    JSON.stringify(result.user)
                );

                message.textContent =
                    "Login successful!";

                message.style.color = "green";

                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1000);

            } else {

                message.textContent = result.message;
                message.style.color = "red";
            }

        } catch (error) {

            message.textContent =
                "Unable to connect to server.";

            message.style.color = "red";

            console.error(error);
        }
    });
}