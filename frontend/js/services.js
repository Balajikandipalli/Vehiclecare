const API_URL =
    "http://127.0.0.1:5000";


// ==========================
// AUTH
// ==========================

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


// ==========================
// VEHICLE ID
// ==========================

const params =
    new URLSearchParams(
        window.location.search
    );


const vehicleId =
    params.get("id");


if (!vehicleId) {

    alert(
        "Vehicle ID is missing."
    );

    window.location.href =
        "vehicles.html";

}


// ==========================
// GLOBAL SERVICES
// ==========================

let allServices = [];

let editingServiceId = null;


// ==========================
// LOAD SERVICES
// ==========================

async function loadServices() {

    const serviceList =
        document.getElementById(
            "serviceList"
        );


    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${vehicleId}/services`,
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

            serviceList.innerHTML =
                `<p>
                    ${escapeHtml(
                        result.message ||
                        "Unable to load services."
                    )}
                </p>`;

            return;

        }


        allServices =
            result.services || [];


        updateSummary(
            allServices
        );


        renderServices(
            allServices
        );

    }

    catch (error) {

        console.error(
            "Service loading error:",
            error
        );


        serviceList.innerHTML =
            "<p>Unable to connect to server.</p>";

    }

}


// ==========================
// UPDATE SUMMARY
// ==========================

function updateSummary(
    services
) {

    let overdue =
        0;


    let dueSoon =
        0;


    let upcoming =
        0;


    services.forEach(
        service => {

            const status =
                String(
                    service.reminder_status ||
                    ""
                ).toUpperCase();


            if (
                status ===
                "OVERDUE"
            ) {

                overdue++;

            }

            else if (
                status ===
                "DUE_SOON"
            ) {

                dueSoon++;

            }

            else {

                upcoming++;

            }

        }
    );


    document.getElementById(
        "totalServiceCount"
    ).textContent =
        services.length;


    document.getElementById(
        "overdueServiceCount"
    ).textContent =
        overdue;


    document.getElementById(
        "dueSoonServiceCount"
    ).textContent =
        dueSoon;


    document.getElementById(
        "upcomingServiceCount"
    ).textContent =
        upcoming;

}


// ==========================
// RENDER SERVICES
// ==========================

function renderServices(
    services
) {

    const serviceList =
        document.getElementById(
            "serviceList"
        );


    if (!services.length) {

        serviceList.innerHTML = `

            <div class="service-empty">

                <h2>
                    No Service Records 🔧
                </h2>

                <p>
                    Add your first service record.
                </p>

                <button
                    type="button"
                    class="primary-btn"
                    onclick="openServiceForm()"
                >
                    + Add Service
                </button>

            </div>

        `;

        return;

    }


    const overdue =
        services.filter(
            service =>
                getReminderStatus(
                    service
                ) ===
                "OVERDUE"
        );


    const dueSoon =
        services.filter(
            service =>
                getReminderStatus(
                    service
                ) ===
                "DUE_SOON"
        );


    const upcoming =
        services.filter(
            service =>
                getReminderStatus(
                    service
                ) !==
                    "OVERDUE" &&
                getReminderStatus(
                    service
                ) !==
                    "DUE_SOON"
        );


    serviceList.innerHTML = `

        ${renderServiceGroup(
            "🔴 Overdue Services",
            overdue,
            "count-overdue",
            "No overdue services."
        )}

        ${renderServiceGroup(
            "🟡 Due Soon",
            dueSoon,
            "count-due",
            "No services due soon."
        )}

        ${renderServiceGroup(
            "🟢 Upcoming Services",
            upcoming,
            "count-upcoming",
            "No upcoming services."
        )}

    `;

}


// ==========================
// RENDER SERVICE GROUP
// ==========================

function renderServiceGroup(
    title,
    services,
    countClass,
    emptyText
) {

    return `

        <div class="service-group">

            <div class="service-group-title">

                <h2>
                    ${title}
                </h2>

                <span
                    class="service-group-count ${countClass}"
                >
                    ${services.length}
                </span>

            </div>


            ${
                services.length
                    ? `
                        <div class="service-grid">

                            ${services
                                .map(
                                    service =>
                                        renderServiceCard(
                                            service
                                        )
                                )
                                .join("")}

                        </div>
                    `
                    :
                    `
                        <div class="service-empty">

                            <p>
                                ${emptyText}
                            </p>

                        </div>
                    `
            }

        </div>

    `;

}


// ==========================
// SERVICE CARD
// ==========================

function renderServiceCard(
    service
) {

    const status =
        getReminderStatus(
            service
        );


    let statusText =
        "Upcoming";


    let statusClass =
        "status-upcoming";


    if (
        status ===
        "DUE_SOON"
    ) {

        statusText =
            "Due Soon";


        statusClass =
            "status-due";

    }


    if (
        status ===
        "OVERDUE"
    ) {

        statusText =
            "Overdue";


        statusClass =
            "status-overdue";

    }


    return `

        <div class="service-card">


            <div class="service-icon">
                🔧
            </div>


            <h3>
                ${escapeHtml(
                    service.service_type ||
                    "Service"
                )}
            </h3>


            <p>
                📅
                ${escapeHtml(
                    service.service_date ||
                    "Not set"
                )}
            </p>


            <p>
                🛣️
                ${escapeHtml(
                    String(
                        service.service_km ||
                        0
                    )
                )}
                KM
            </p>


            <p>
                💰
                ₹${escapeHtml(
                    String(
                        service.cost ||
                        0
                    )
                )}
            </p>


            <p>
                🏢
                ${escapeHtml(
                    service.service_center ||
                    "N/A"
                )}
            </p>


            <div
                class="service-status ${statusClass}"
            >
                ${statusText}
            </div>


            <hr>


            <p>

                <strong>
                    Next Service
                </strong>

            </p>


            <p>
                📅
                ${escapeHtml(
                    service.next_service_date ||
                    "Not set"
                )}
            </p>


            <p>
                🛣️
                ${
                    service.next_service_km
                        ? escapeHtml(
                            String(
                                service.next_service_km
                            )
                        ) + " KM"
                        :
                        "Not set"
                }
            </p>


            ${
                service.notes
                    ?
                    `
                        <p>
                            📝
                            ${escapeHtml(
                                service.notes
                            )}
                        </p>
                    `
                    :
                    ""
            }


            <p>

                <strong>
                    Record Status:
                </strong>

                ${escapeHtml(
                    service.status ||
                    "N/A"
                )}

            </p>


            <div class="service-card-actions">


                <button
                    type="button"
                    class="primary-btn"
                    onclick="editService(${service.id})"
                >
                    ✏️ Edit
                </button>


                <button
                    type="button"
                    class="delete-btn"
                    onclick="deleteService(${service.id})"
                >
                    🗑️ Delete
                </button>


            </div>


        </div>

    `;

}


// ==========================
// GET REMINDER STATUS
// ==========================

function getReminderStatus(
    service
) {

    return String(
        service.reminder_status ||
        "UPCOMING"
    ).toUpperCase();

}


// ==========================
// SEARCH
// ==========================

const serviceSearch =
    document.getElementById(
        "serviceSearch"
    );


if (serviceSearch) {

    serviceSearch.addEventListener(
        "input",
        function() {

            const query =
                this.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderServices(
                    allServices
                );

                return;

            }


            const filtered =
                allServices.filter(
                    service => {

                        const type =
                            String(
                                service.service_type ||
                                ""
                            ).toLowerCase();


                        const center =
                            String(
                                service.service_center ||
                                ""
                            ).toLowerCase();


                        const notes =
                            String(
                                service.notes ||
                                ""
                            ).toLowerCase();


                        return (
                            type.includes(
                                query
                            ) ||
                            center.includes(
                                query
                            ) ||
                            notes.includes(
                                query
                            )
                        );

                    }
                );


            renderServices(
                filtered
            );

        }
    );

}


// ==========================
// OPEN FORM
// ==========================

function openServiceForm() {

    document.getElementById(
        "serviceForm"
    ).style.display =
        "block";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ==========================
// CLOSE FORM
// ==========================

function closeServiceForm() {

    editingServiceId =
        null;


    document.getElementById(
        "serviceForm"
    ).style.display =
        "none";


    document.getElementById(
        "addServiceForm"
    ).reset();


    document.getElementById(
        "serviceMessage"
    ).textContent =
        "";


    document.getElementById(
        "serviceFormTitle"
    ).textContent =
        "Add Service";


    document.getElementById(
        "serviceSubmitButton"
    ).textContent =
        "Add Service";

}


// ==========================
// GET FORM DATA
// ==========================

function getServiceFormData() {

    return {

        service_type:
            document.getElementById(
                "service_type"
            ).value,

        service_date:
            document.getElementById(
                "service_date"
            ).value,

        service_km:
            Number(
                document.getElementById(
                    "service_km"
                ).value ||
                0
            ),

        next_service_date:
            document.getElementById(
                "next_service_date"
            ).value,

        next_service_km:
            Number(
                document.getElementById(
                    "next_service_km"
                ).value ||
                0
            ),

        cost:
            Number(
                document.getElementById(
                    "cost"
                ).value ||
                0
            ),

        service_center:
            document.getElementById(
                "service_center"
            ).value.trim(),

        notes:
            document.getElementById(
                "notes"
            ).value.trim(),

        status:
            document.getElementById(
                "status"
            ).value

    };

}


// ==========================
// ADD / UPDATE SERVICE
// ==========================

document
    .getElementById(
        "addServiceForm"
    )
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const data =
                getServiceFormData();


            const message =
                document.getElementById(
                    "serviceMessage"
                );


            // ==========================
            // VALIDATION
            // ==========================

            if (
                !data.service_type ||
                !data.service_date
            ) {

                message.textContent =
                    "Service type and service date are required.";

                message.style.color =
                    "red";

                return;

            }


            if (
                data.service_km < 0 ||
                data.next_service_km < 0 ||
                data.cost < 0
            ) {

                message.textContent =
                    "KM and cost cannot be negative.";

                message.style.color =
                    "red";

                return;

            }


            try {

                let url =
                    `${API_URL}/api/vehicles/${vehicleId}/services`;


                let method =
                    "POST";


                if (
                    editingServiceId
                ) {

                    url =
                        `${API_URL}/api/services/${editingServiceId}`;

                    method =
                        "PUT";

                }


                const response =
                    await fetch(
                        url,
                        {
                            method: method,

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`

                            },

                            body:
                                JSON.stringify(
                                    data
                                )

                        }
                    );


                const result =
                    await response.json();


                if (response.ok) {

                    message.textContent =
                        editingServiceId
                            ? "Service updated successfully!"
                            : "Service added successfully!";


                    message.style.color =
                        "green";


                    setTimeout(
                        () => {

                            closeServiceForm();

                            loadServices();

                        },
                        700
                    );

                }

                else {

                    message.textContent =
                        result.message ||
                        "Unable to save service.";

                    message.style.color =
                        "red";

                }

            }

            catch (error) {

                console.error(
                    "Service save error:",
                    error
                );


                message.textContent =
                    "Unable to connect to server.";

                message.style.color =
                    "red";

            }

        }
    );


// ==========================
// EDIT SERVICE
// ==========================

async function editService(
    id
) {

    const service =
        allServices.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if (!service) {

        alert(
            "Service record not found."
        );

        return;

    }


    editingServiceId =
        id;


    document.getElementById(
        "service_type"
    ).value =
        service.service_type ||
        "";


    document.getElementById(
        "service_date"
    ).value =
        service.service_date ||
        "";


    document.getElementById(
        "service_km"
    ).value =
        service.service_km ||
        0;


    document.getElementById(
        "next_service_date"
    ).value =
        service.next_service_date ||
        "";


    document.getElementById(
        "next_service_km"
    ).value =
        service.next_service_km ||
        0;


    document.getElementById(
        "cost"
    ).value =
        service.cost ||
        0;


    document.getElementById(
        "service_center"
    ).value =
        service.service_center ||
        "";


    document.getElementById(
        "notes"
    ).value =
        service.notes ||
        "";


    document.getElementById(
        "status"
    ).value =
        service.status ||
        "Scheduled";


    document.getElementById(
        "serviceFormTitle"
    ).textContent =
        "Edit Service";


    document.getElementById(
        "serviceSubmitButton"
    ).textContent =
        "Update Service";


    document.getElementById(
        "serviceMessage"
    ).textContent =
        "";


    openServiceForm();

}


// ==========================
// DELETE SERVICE
// ==========================

async function deleteService(
    id
) {

    const confirmed =
        confirm(
            "Delete this service record?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/services/${id}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const result =
            await response.json();


        if (response.ok) {

            alert(
                "Service deleted successfully."
            );


            loadServices();

        }

        else {

            alert(
                result.message ||
                "Unable to delete service."
            );

        }

    }

    catch (error) {

        console.error(
            "Delete service error:",
            error
        );


        alert(
            "Unable to connect to server."
        );

    }

}


// ==========================
// HTML ESCAPE
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

loadServices();