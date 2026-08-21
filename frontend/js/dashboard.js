const API_URL =
    "http://127.0.0.1:5000";


// ==========================
// AUTH
// ==========================

const token =
    localStorage.getItem("token");

let user =
    JSON.parse(
        localStorage.getItem("user")
    );


if (!token || !user) {

    window.location.href =
        "login.html";
}


// ==========================
// USER NAME
// ==========================

document.getElementById(
    "username"
).textContent =
    user.name || "User";


// ==========================
// LOAD SERVICE REMINDERS
// ==========================

async function loadReminders() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/dashboard/reminders`,
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

            console.error(
                "Reminder error:",
                result.message
            );

            return;
        }


        // ==========================
        // COUNTS
        // ==========================

        document.getElementById(
            "overdueCount"
        ).textContent =
            result.summary.overdue || 0;


        document.getElementById(
            "dueSoonCount"
        ).textContent =
            result.summary.due_soon || 0;


        document.getElementById(
            "upcomingCount"
        ).textContent =
            result.summary.upcoming || 0;


        // ==========================
        // SERVICE ALERTS
        // ==========================

        const alerts =
            document.getElementById(
                "serviceAlerts"
            );


        const allAlerts = [

            ...(result.overdue || []),

            ...(result.due_soon || [])

        ];


        if (allAlerts.length === 0) {

            alerts.innerHTML = `

                <div class="no-alerts">

                    <div>
                        ✅
                    </div>

                    <h3>
                        No Service Alerts
                    </h3>

                    <p>
                        Your vehicles are up to date.
                    </p>

                </div>

            `;

        } else {

            alerts.innerHTML =
                allAlerts.map(
                    item => {

                        const isOverdue =
                            item.status ===
                            "OVERDUE";


                        return `

                            <div class="
                                service-alert
                                ${
                                    isOverdue
                                        ? "alert-overdue"
                                        : "alert-due"
                                }
                            ">

                                <div class="alert-icon">

                                    ${
                                        isOverdue
                                            ? "🔴"
                                            : "🟡"
                                    }

                                </div>


                                <div class="alert-content">

                                    <h3>

                                        ${
                                            escapeHtml(
                                                item.service_type
                                            )
                                        }

                                    </h3>


                                    <p>

                                        ${
                                            escapeHtml(
                                                item.vehicle_name
                                            )
                                        }

                                        -

                                        ${
                                            escapeHtml(
                                                item.vehicle_number
                                            )
                                        }

                                    </p>


                                    <p>

                                        Next service:

                                        ${
                                            escapeHtml(
                                                item.next_service_date ||
                                                "Not set"
                                            )
                                        }

                                    </p>


                                    <p>

                                        Next service KM:

                                        ${
                                            escapeHtml(
                                                String(
                                                    item.next_service_km ||
                                                    "Not set"
                                                )
                                            )
                                        }

                                    </p>

                                </div>


                                <div>

                                    <span class="
                                        alert-status
                                        ${
                                            isOverdue
                                                ? "alert-status-overdue"
                                                : "alert-status-due"
                                        }
                                    ">

                                        ${
                                            isOverdue
                                                ? "OVERDUE"
                                                : "DUE SOON"
                                        }

                                    </span>

                                </div>

                            </div>

                        `;

                    }
                ).join("");

        }

    }

    catch (error) {

        console.error(
            "Reminder error:",
            error
        );

    }

}


// ==========================
// LOAD INSURANCE & PUC
// ==========================

async function loadDocumentAlerts() {

    const container =
        document.getElementById(
            "documentAlerts"
        );


    try {

        // ==========================
        // GET VEHICLES
        // ==========================

        const response =
            await fetch(
                `${API_URL}/api/vehicles`,
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

            console.error(
                "Vehicle loading error:",
                result.message
            );

            container.innerHTML = `
                <div class="no-document-alerts">
                    <div class="no-document-alerts-icon">
                        ⚠️
                    </div>
                    <h3>
                        Unable to load document alerts
                    </h3>
                </div>
            `;

            return;
        }


        const vehicles =
            result.vehicles ||
            result.data ||
            [];


        if (!vehicles.length) {

            showNoDocumentAlerts(
                "No vehicles added yet."
            );

            return;
        }


        // ==========================
        // LOAD DOCUMENTS
        // ==========================

        const requests =
            vehicles.map(
                async vehicle => {

                    try {

                        const response =
                            await fetch(
                                `${API_URL}/api/vehicles/${vehicle.id}/documents`,
                                {
                                    method: "GET",

                                    headers: {
                                        "Authorization":
                                            `Bearer ${token}`
                                    }
                                }
                            );


                        if (!response.ok) {

                            return [];

                        }


                        const result =
                            await response.json();


                        const documents =
                            result.documents || [];


                        return documents.map(
                            document => ({

                                ...document,

                                vehicle_name:
                                    `${vehicle.make || ""} ${vehicle.model || ""}`.trim(),

                                vehicle_number:
                                    vehicle.vehicle_number ||
                                    "Unknown"

                            })
                        );

                    }

                    catch (error) {

                        console.error(
                            `Document loading failed for vehicle ${vehicle.id}:`,
                            error
                        );

                        return [];

                    }

                }
            );


        const documentArrays =
            await Promise.all(
                requests
            );


        const documents =
            documentArrays.flat();


        // ==========================
        // FILTER ALERTS
        // ==========================

        const alerts =
            documents.filter(
                document =>
                    document.status ===
                        "OVERDUE" ||
                    document.status ===
                        "DUE_SOON"
            );


        // ==========================
        // SORT
        // ==========================

        alerts.sort(
            (a, b) => {

                if (
                    a.status ===
                    "OVERDUE" &&
                    b.status !==
                    "OVERDUE"
                ) {

                    return -1;

                }


                if (
                    a.status !==
                    "OVERDUE" &&
                    b.status ===
                    "OVERDUE"
                ) {

                    return 1;

                }


                return String(
                    a.expiry_date || ""
                ).localeCompare(
                    String(
                        b.expiry_date || ""
                    )
                );

            }
        );


        // ==========================
        // NO ALERTS
        // ==========================

        if (!alerts.length) {

            showNoDocumentAlerts(
                "Your Insurance and PUC documents are up to date."
            );

            return;
        }


        // ==========================
        // DISPLAY ALERTS
        // ==========================

        container.innerHTML =
            `
            <div class="document-alert-grid">

                ${
                    alerts.map(
                        document =>
                            createDocumentAlert(
                                document
                            )
                    ).join("")
                }

            </div>
            `;

    }

    catch (error) {

        console.error(
            "Document alert error:",
            error
        );


        container.innerHTML = `

            <div class="no-document-alerts">

                <div class="no-document-alerts-icon">
                    ⚠️
                </div>

                <h3>
                    Unable to load Insurance/PUC alerts
                </h3>

                <p>
                    Please refresh the page.
                </p>

            </div>

        `;

    }

}


// ==========================
// CREATE DOCUMENT ALERT
// ==========================

function createDocumentAlert(
    document
) {

    const isInsurance =
        document.document_type ===
        "INSURANCE";


    const isOverdue =
        document.status ===
        "OVERDUE";


    const icon =
        isInsurance
            ? "🛡️"
            : "📄";


    const title =
        isInsurance
            ? "Insurance"
            : "PUC";


    const statusText =
        isOverdue
            ? "EXPIRED"
            : "EXPIRES SOON";


    const cardClass =
        isOverdue
            ? "document-alert-overdue"
            : "document-alert-due";


    return `

        <div class="
            document-alert-card
            ${cardClass}
        ">

            <div class="document-alert-icon">

                ${icon}

            </div>


            <div class="document-alert-content">

                <h3>

                    ${title}

                </h3>


                <p>

                    <strong>
                        Vehicle:
                    </strong>

                    ${escapeHtml(
                        document.vehicle_name
                    )}

                </p>


                <p>

                    <strong>
                        Number:
                    </strong>

                    ${escapeHtml(
                        document.vehicle_number
                    )}

                </p>


                <p>

                    <strong>
                        ${
                            isInsurance
                                ? "Policy:"
                                : "Certificate:"
                        }
                    </strong>

                    ${escapeHtml(
                        document.document_number ||
                        "Not provided"
                    )}

                </p>


                <p>

                    <strong>
                        Expiry:
                    </strong>

                    ${escapeHtml(
                        document.expiry_date ||
                        "Not set"
                    )}

                </p>


                <span class="
                    document-alert-status
                ">

                    ${
                        isOverdue
                            ? "🔴 EXPIRED"
                            : "🟡 EXPIRES SOON"
                    }

                </span>

            </div>

        </div>

    `;

}


// ==========================
// NO DOCUMENT ALERTS
// ==========================

function showNoDocumentAlerts(
    message
) {

    const container =
        document.getElementById(
            "documentAlerts"
        );


    container.innerHTML = `

        <div class="no-document-alerts">

            <div class="no-document-alerts-icon">
                ✅
            </div>

            <h3>
                No Insurance or PUC Alerts
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

        </div>

    `;

}

// ==========================
// LOAD DASHBOARD STATUS
// ==========================

async function loadDashboardStatus() {

    try {

        // ==========================
        // VEHICLE COUNT
        // ==========================

        const vehicleResponse =
            await fetch(
                `${API_URL}/api/vehicles`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const vehicleResult =
            await vehicleResponse.json();


        const vehicles =
            vehicleResult.vehicles ||
            vehicleResult.data ||
            [];


        document.getElementById(
            "vehicleCount"
        ).textContent =
            vehicles.length;


        // ==========================
        // SERVICE ALERT COUNT
        // ==========================

        const reminderResponse =
            await fetch(
                `${API_URL}/api/dashboard/reminders`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const reminderResult =
            await reminderResponse.json();


        if (reminderResponse.ok) {

            const overdue =
                Number(
                    reminderResult.summary?.overdue ||
                    0
                );


            const dueSoon =
                Number(
                    reminderResult.summary?.due_soon ||
                    0
                );


            document.getElementById(
                "serviceAlertCount"
            ).textContent =
                overdue + dueSoon;

        }


        // ==========================
        // INSURANCE / PUC
        // ==========================

        let insuranceCount = 0;

        let pucCount = 0;


        for (
            const vehicle of vehicles
        ) {

            try {

                const response =
                    await fetch(
                        `${API_URL}/api/vehicles/${vehicle.id}/documents`,
                        {
                            method: "GET",

                            headers: {
                                "Authorization":
                                    `Bearer ${token}`
                            }
                        }
                    );


                if (!response.ok) {
                    continue;
                }


                const result =
                    await response.json();


                const documents =
                    result.documents || [];


                documents.forEach(
                    doc => {

                        if (
                            doc.status ===
                                "OVERDUE" ||
                            doc.status ===
                                "DUE_SOON"
                        ) {

                            if (
                                doc.document_type ===
                                "INSURANCE"
                            ) {

                                insuranceCount++;

                            }


                            if (
                                doc.document_type ===
                                "PUC"
                            ) {

                                pucCount++;

                            }

                        }

                    }
                );

            }

            catch (error) {

                console.error(
                    "Document status error:",
                    error
                );

            }

        }


        document.getElementById(
            "insuranceAlertCount"
        ).textContent =
            insuranceCount;


        document.getElementById(
            "pucAlertCount"
        ).textContent =
            pucCount;


    }

    catch (error) {

        console.error(
            "Dashboard status error:",
            error
        );

    }

}


// ==========================
// ACCOUNT SETTINGS
// ==========================

function openAccountSettings() {

    const modal =
        document.getElementById(
            "accountModal"
        );


    const currentEmail =
        document.getElementById(
            "currentEmail"
        );


    const newEmail =
        document.getElementById(
            "newEmail"
        );


    const confirmEmail =
        document.getElementById(
            "confirmEmail"
        );


    const message =
        document.getElementById(
            "emailMessage"
        );


    currentEmail.value =
        user.email || "";


    newEmail.value = "";

    confirmEmail.value = "";

    message.textContent = "";

    message.style.color = "";


    modal.style.display =
        "flex";


    setTimeout(
        () => {

            newEmail.focus();

        },
        100
    );

}


// ==========================
// CLOSE ACCOUNT SETTINGS
// ==========================

function closeAccountSettings() {

    document.getElementById(
        "accountModal"
    ).style.display =
        "none";

}


// ==========================
// CLOSE MODAL OUTSIDE CLICK
// ==========================

document.addEventListener(
    "click",
    function(event) {

        const modal =
            document.getElementById(
                "accountModal"
            );


        if (
            event.target ===
            modal
        ) {

            closeAccountSettings();

        }

    }
);


// ==========================
// UPDATE EMAIL
// ==========================

async function updateEmail() {

    const newEmail =
        document.getElementById(
            "newEmail"
        ).value
        .trim()
        .toLowerCase();


    const confirmEmail =
        document.getElementById(
            "confirmEmail"
        ).value
        .trim()
        .toLowerCase();


    const message =
        document.getElementById(
            "emailMessage"
        );


    const button =
        document.getElementById(
            "updateEmailButton"
        );


    message.textContent = "";

    message.style.color = "";


    // EMPTY

    if (!newEmail) {

        message.textContent =
            "Please enter your new email.";

        message.style.color =
            "red";

        return;
    }


    // VALIDATION

    if (
        !isValidEmail(
            newEmail
        )
    ) {

        message.textContent =
            "Please enter a valid email address.";

        message.style.color =
            "red";

        return;
    }


    // CONFIRM

    if (
        newEmail !==
        confirmEmail
    ) {

        message.textContent =
            "Email addresses do not match.";

        message.style.color =
            "red";

        return;
    }


    // SAME EMAIL

    if (
        newEmail ===
        (user.email || "")
            .toLowerCase()
    ) {

        message.textContent =
            "This is already your current email.";

        message.style.color =
            "red";

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Updating...";


    try {

        const response =
            await fetch(
                `${API_URL}/api/auth/update-email`,
                {
                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify({
                            email: newEmail
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.textContent =
                result.message ||
                "Unable to update email.";

            message.style.color =
                "red";

            return;
        }


        user.email =
            result.user.email;


        localStorage.setItem(
            "user",
            JSON.stringify(user)
        );


        document.getElementById(
            "currentEmail"
        ).value =
            user.email;


        document.getElementById(
            "newEmail"
        ).value = "";


        document.getElementById(
            "confirmEmail"
        ).value = "";


        message.textContent =
            "Email updated successfully! Future service reminders will be sent to this email.";

        message.style.color =
            "green";

    }

    catch (error) {

        console.error(
            "Email update error:",
            error
        );


        message.textContent =
            "Unable to connect to server.";

        message.style.color =
            "red";

    }

    finally {

        button.disabled =
            false;

        button.textContent =
            "Update Email";

    }

}


// ==========================
// EMAIL VALIDATION
// ==========================

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


// ==========================
// HTML ESCAPING
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

loadReminders();

loadDocumentAlerts();

loadDashboardStatus();