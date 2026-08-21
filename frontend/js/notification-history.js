const API_URL =
    "http://127.0.0.1:5000";


const token =
    localStorage.getItem("token");

const user =
    JSON.parse(
        localStorage.getItem("user")
    );


if (!token || !user) {

    window.location.href =
        "login.html";

}


let notifications = [];


// ==========================
// LOAD HISTORY
// ==========================

async function loadNotificationHistory() {

    const container =
        document.getElementById(
            "notificationList"
        );


    try {

        const response =
            await fetch(
                `${API_URL}/api/notifications/history`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p>
                    ${escapeHtml(
                        result.message ||
                        "Unable to load notifications."
                    )}
                </p>`;

            return;

        }


        notifications =
            result.notifications || [];


        renderNotifications(
            notifications
        );

    }

    catch (error) {

        console.error(
            error
        );


        container.innerHTML =
            "<p>Unable to connect to server.</p>";

    }

}


// ==========================
// RENDER
// ==========================

function renderNotifications(
    items
) {

    const container =
        document.getElementById(
            "notificationList"
        );


    if (!items.length) {

        container.innerHTML = `

            <div class="service-empty">

                <h2>
                    📭 No Notifications Yet
                </h2>

                <p>
                    Automatic reminder emails
                    will appear here after they are sent.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML = items
        .map(
            notification =>
                createNotificationCard(
                    notification
                )
        )
        .join("");

}


// ==========================
// CARD
// ==========================

function createNotificationCard(
    notification
) {

    let icon =
        "📧";


    let title =
        "Email Reminder";


    if (
        notification.notification_type ===
        "SERVICE"
    ) {

        icon =
            "🔧";

        title =
            "Service Reminder";

    }

    else if (
        notification.notification_type ===
        "INSURANCE"
    ) {

        icon =
            "🛡️";

        title =
            "Insurance Reminder";

    }

    else if (
        notification.notification_type ===
        "PUC"
    ) {

        icon =
            "📄";

        title =
            "PUC Reminder";

    }


    let statusClass =
        "status-valid";

    let statusText =
        "✅ Sent";


    if (
        notification.status !==
        "SENT"
    ) {

        statusClass =
            "status-overdue";

        statusText =
            "❌ Failed";

    }


    const vehicle =
        notification.vehicle;


    const service =
        notification.service;


    const document =
        notification.document;


    let details = "";


    if (
        notification.notification_type ===
        "SERVICE" &&
        service
    ) {

        details = `
            <p>
                🔧
                ${escapeHtml(
                    service.service_type ||
                    "Service"
                )}
            </p>
        `;

    }


    if (
        (
            notification.notification_type ===
            "INSURANCE"
        ) &&
        document
    ) {

        details = `
            <p>
                🛡️ Insurance
            </p>

            <p>
                📅 Expiry:
                ${escapeHtml(
                    document.expiry_date ||
                    "N/A"
                )}
            </p>
        `;

    }


    if (
        (
            notification.notification_type ===
            "PUC"
        ) &&
        document
    ) {

        details = `
            <p>
                📄 PUC
            </p>

            <p>
                📅 Expiry:
                ${escapeHtml(
                    document.expiry_date ||
                    "N/A"
                )}
            </p>
        `;

    }


    return `

        <div
            class="service-card"
            style="margin-bottom:20px;"
        >

            <div class="service-icon">
                ${icon}
            </div>


            <h3>
                ${title}
            </h3>


            ${
                vehicle
                ?
                `
                    <p>
                        🚗
                        <strong>
                            ${escapeHtml(
                                vehicle.name ||
                                "Vehicle"
                            )}
                        </strong>
                    </p>

                    <p>
                        🔢
                        ${escapeHtml(
                            vehicle.vehicle_number ||
                            "N/A"
                        )}
                    </p>
                `
                :
                ""
            }


            ${details}


            <p>
                📧
                ${escapeHtml(
                    notification.recipient
                )}
            </p>


            <p>
                📝
                ${escapeHtml(
                    notification.subject
                )}
            </p>


            <p>
                🕐
                ${formatDate(
                    notification.sent_at
                )}
            </p>


            <div
                class="service-status ${statusClass}"
            >
                ${statusText}
            </div>

        </div>

    `;

}


// ==========================
// SEARCH
// ==========================

document
    .getElementById(
        "notificationSearch"
    )
    .addEventListener(
        "input",
        function() {

            const query =
                this.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderNotifications(
                    notifications
                );

                return;

            }


            const filtered =
                notifications.filter(
                    item => {

                        const text =
                            JSON.stringify(
                                item
                            ).toLowerCase();


                        return text.includes(
                            query
                        );

                    }
                );


            renderNotifications(
                filtered
            );

        }
    );


// ==========================
// DATE
// ==========================

function formatDate(
    value
) {

    if (!value) {

        return "N/A";

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleString();

}


// ==========================
// ESCAPE HTML
// ==========================

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ==========================
// LOGOUT
// ==========================

function logout() {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

    window.location.href =
        "login.html";

}


// ==========================
// INITIAL LOAD
// ==========================

loadNotificationHistory();