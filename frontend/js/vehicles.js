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
// GLOBAL VEHICLES
// ==========================

let allVehicles = [];


// ==========================
// LOAD VEHICLES
// ==========================

async function loadVehicles() {

    const vehicleList =
        document.getElementById(
            "vehicleList"
        );


    try {

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

            vehicleList.innerHTML =
                `<p>
                    ${escapeHtml(
                        result.message ||
                        "Unable to load vehicles."
                    )}
                </p>`;

            return;
        }


        allVehicles =
            result.vehicles || [];


        if (!allVehicles.length) {

            vehicleList.innerHTML = `

                <div class="empty-state">

                    <h2>
                        No Vehicles Yet 🚗
                    </h2>

                    <p>
                        Add your first vehicle to start
                        tracking its service.
                    </p>

                    <button
                        class="primary-btn"
                        type="button"
                        onclick="openVehicleForm()"
                    >
                        + Add Vehicle
                    </button>

                </div>

            `;

            return;
        }


        renderVehicles(
            allVehicles
        );


        // Load service/document statuses

        await loadVehicleStatuses();

    }

    catch (error) {

        console.error(
            "Vehicle loading error:",
            error
        );


        vehicleList.innerHTML = `

            <p>
                Unable to connect to server.
            </p>

        `;

    }

}


// ==========================
// RENDER VEHICLES
// ==========================

function renderVehicles(
    vehicles
) {

    const vehicleList =
        document.getElementById(
            "vehicleList"
        );


    if (!vehicles.length) {

        vehicleList.innerHTML = `

            <div class="no-search-results">

                <h2>
                    🔍 No vehicles found
                </h2>

                <p>
                    Try another search.
                </p>

            </div>

        `;

        return;
    }


    vehicleList.innerHTML =
        vehicles.map(
            vehicle => `

                <div
                    class="vehicle-card"
                    data-vehicle-id="${vehicle.id}"
                >

                    <div class="vehicle-icon">
                        🚗
                    </div>


                    <h2>

                        ${escapeHtml(
                            vehicle.make
                        )}

                        ${escapeHtml(
                            vehicle.model
                        )}

                    </h2>


                    <p class="vehicle-number">

                        ${escapeHtml(
                            vehicle.vehicle_number
                        )}

                    </p>


                    <div class="vehicle-details">

                        <span>
                            📅
                            ${escapeHtml(
                                vehicle.manufacturing_year ||
                                "N/A"
                            )}
                        </span>


                        <span>
                            ⛽
                            ${escapeHtml(
                                vehicle.fuel_type ||
                                "N/A"
                            )}
                        </span>


                        <span>
                            🛣️
                            ${escapeHtml(
                                String(
                                    vehicle.current_km ||
                                    0
                                )
                            )}
                            KM
                        </span>


                        <span>
                            📆
                            ${escapeHtml(
                                vehicle.purchase_date ||
                                "N/A"
                            )}
                        </span>

                    </div>


                    <!-- STATUS -->

                    <div class="vehicle-status-section">

                        <div class="vehicle-status-title">

                            Current Status

                        </div>


                        <div class="vehicle-status-grid">


                            <div
                                id="service-status-${vehicle.id}"
                                class="vehicle-status-item status-loading"
                            >
                                🔧 Service...
                            </div>


                            <div
                                id="insurance-status-${vehicle.id}"
                                class="vehicle-status-item status-loading"
                            >
                                🛡️ Insurance...
                            </div>


                            <div
                                id="puc-status-${vehicle.id}"
                                class="vehicle-status-item status-loading"
                            >
                                📄 PUC...
                            </div>


                        </div>

                    </div>


                    <!-- ACTIONS -->

                    <div class="vehicle-actions">


                        <button
                            type="button"
                            class="primary-btn"
                            onclick="editVehicle(${vehicle.id})"
                        >
                            ✏️ Edit
                        </button>


                        <button
                            type="button"
                            class="secondary-btn"
                            onclick="viewVehicle(${vehicle.id})"
                        >
                            👁️ View
                        </button>


                        <button
                            type="button"
                            class="delete-btn"
                            onclick="deleteVehicle(${vehicle.id})"
                        >
                            🗑️ Delete
                        </button>


                    </div>

                </div>

            `
        ).join("");

}


// ==========================
// LOAD VEHICLE STATUSES
// ==========================

async function loadVehicleStatuses() {

    for (
        const vehicle of allVehicles
    ) {

        try {

            // ==========================
            // SERVICES
            // ==========================

            const serviceResponse =
                await fetch(
                    `${API_URL}/api/vehicles/${vehicle.id}/services`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );


            let serviceStatus =
                "UPCOMING";


            if (serviceResponse.ok) {

                const serviceResult =
                    await serviceResponse.json();


                const services =
                    serviceResult.services ||
                    serviceResult.data ||
                    [];


                let hasOverdue = false;

                let hasDueSoon = false;


                services.forEach(
                    service => {

                        const status =
                            service.status;


                        if (
                            status ===
                            "OVERDUE"
                        ) {

                            hasOverdue =
                                true;

                        }

                        else if (
                            status ===
                            "DUE_SOON"
                        ) {

                            hasDueSoon =
                                true;

                        }

                    }
                );


                if (hasOverdue) {

                    serviceStatus =
                        "OVERDUE";

                }

                else if (hasDueSoon) {

                    serviceStatus =
                        "DUE_SOON";

                }

            }


            setStatus(
                `service-status-${vehicle.id}`,
                "🔧 Service",
                serviceStatus
            );


            // ==========================
            // INSURANCE / PUC
            // ==========================

            const documentResponse =
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


            let insuranceStatus =
                "UPCOMING";


            let pucStatus =
                "UPCOMING";


            if (documentResponse.ok) {

                const documentResult =
                    await documentResponse.json();


                const documents =
                    documentResult.documents ||
                    [];


                const insurance =
                    documents.find(
                        doc =>
                            doc.document_type ===
                            "INSURANCE"
                    );


                const puc =
                    documents.find(
                        doc =>
                            doc.document_type ===
                            "PUC"
                    );


                if (insurance) {

                    insuranceStatus =
                        insurance.status ||
                        calculateDocumentStatus(
                            insurance.expiry_date
                        );

                }


                if (puc) {

                    pucStatus =
                        puc.status ||
                        calculateDocumentStatus(
                            puc.expiry_date
                        );

                }

            }


            setStatus(
                `insurance-status-${vehicle.id}`,
                "🛡️ Insurance",
                insuranceStatus
            );


            setStatus(
                `puc-status-${vehicle.id}`,
                "📄 PUC",
                pucStatus
            );


        }

        catch (error) {

            console.error(
                `Status loading failed for vehicle ${vehicle.id}:`,
                error
            );


            setStatus(
                `service-status-${vehicle.id}`,
                "🔧 Service",
                "UPCOMING"
            );


            setStatus(
                `insurance-status-${vehicle.id}`,
                "🛡️ Insurance",
                "UPCOMING"
            );


            setStatus(
                `puc-status-${vehicle.id}`,
                "📄 PUC",
                "UPCOMING"
            );

        }

    }

}


// ==========================
// SET STATUS
// ==========================

function setStatus(
    elementId,
    label,
    status
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.className =
        "vehicle-status-item";


    if (
        status ===
        "OVERDUE"
    ) {

        element.classList.add(
            "status-overdue"
        );


        element.textContent =
            `${label} 🔴 Overdue`;

    }

    else if (
        status ===
        "DUE_SOON"
    ) {

        element.classList.add(
            "status-due"
        );


        element.textContent =
            `${label} 🟡 Due Soon`;

    }

    else {

        element.classList.add(
            "status-healthy"
        );


        element.textContent =
            `${label} 🟢 Healthy`;

    }

}


// ==========================
// DOCUMENT STATUS FALLBACK
// ==========================

function calculateDocumentStatus(
    expiryDate
) {

    if (!expiryDate) {

        return "UPCOMING";

    }


    const expiry =
        new Date(
            `${expiryDate}T00:00:00`
        );


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const days =
        Math.ceil(
            (
                expiry -
                today
            ) /
            (
                1000 *
                60 *
                60 *
                24
            )
        );


    if (days < 0) {

        return "OVERDUE";

    }


    if (days <= 30) {

        return "DUE_SOON";

    }


    return "UPCOMING";

}


// ==========================
// SEARCH
// ==========================

const searchInput =
    document.getElementById(
        "vehicleSearch"
    );


if (searchInput) {

    searchInput.addEventListener(
        "input",
        function() {

            const query =
                this.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderVehicles(
                    allVehicles
                );

                loadVehicleStatuses();

                return;

            }


            const filtered =
                allVehicles.filter(
                    vehicle => {

                        const number =
                            String(
                                vehicle.vehicle_number ||
                                ""
                            ).toLowerCase();


                        const make =
                            String(
                                vehicle.make ||
                                ""
                            ).toLowerCase();


                        const model =
                            String(
                                vehicle.model ||
                                ""
                            ).toLowerCase();


                        return (
                            number.includes(
                                query
                            ) ||
                            make.includes(
                                query
                            ) ||
                            model.includes(
                                query
                            )
                        );

                    }
                );


            renderVehicles(
                filtered
            );


            loadVehicleStatusesFor(
                filtered
            );

        }
    );

}


// ==========================
// LOAD STATUS FOR FILTERED
// ==========================

async function loadVehicleStatusesFor(
    vehicles
) {

    const original =
        allVehicles;


    allVehicles =
        vehicles;


    await loadVehicleStatuses();


    allVehicles =
        original;

}


// ==========================
// OPEN ADD FORM
// ==========================

function openVehicleForm() {

    document.getElementById(
        "vehicleForm"
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

function closeVehicleForm() {

    const form =
        document.getElementById(
            "addVehicleForm"
        );


    form.reset();

    delete form.dataset.editId;


    document.getElementById(
        "vehicleForm"
    ).style.display =
        "none";


    document.querySelector(
        "#addVehicleForm button[type='submit']"
    ).textContent =
        "Add Vehicle";


    document.getElementById(
        "vehicleMessage"
    ).textContent =
        "";

}


// ==========================
// GET FORM DATA
// ==========================

function getVehicleFormData() {

    return {

        vehicle_number:
            document.getElementById(
                "vehicle_number"
            ).value.trim(),

        make:
            document.getElementById(
                "make"
            ).value.trim(),

        model:
            document.getElementById(
                "model"
            ).value.trim(),

        manufacturing_year:
            document.getElementById(
                "manufacturing_year"
            ).value
                ? Number(
                    document.getElementById(
                        "manufacturing_year"
                    ).value
                )
                : null,

        fuel_type:
            document.getElementById(
                "fuel_type"
            ).value,

        current_km:
            Number(
                document.getElementById(
                    "current_km"
                ).value || 0
            ),

        purchase_date:
            document.getElementById(
                "purchase_date"
            ).value

    };

}


// ==========================
// ADD / UPDATE VEHICLE
// ==========================

const vehicleForm =
    document.getElementById(
        "addVehicleForm"
    );


if (vehicleForm) {

    vehicleForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const editId =
                this.dataset.editId;


            const data =
                getVehicleFormData();


            const message =
                document.getElementById(
                    "vehicleMessage"
                );


            // ==========================
            // VALIDATION
            // ==========================

            if (
                !data.vehicle_number ||
                !data.make ||
                !data.model
            ) {

                message.textContent =
                    "Vehicle number, make and model are required.";

                message.style.color =
                    "red";

                return;

            }


            if (
                data.current_km < 0
            ) {

                message.textContent =
                    "Current KM cannot be negative.";

                message.style.color =
                    "red";

                return;

            }


            // ==========================
            // UPDATE
            // ==========================

            if (editId) {

                try {

                    const response =
                        await fetch(
                            `${API_URL}/api/vehicles/${editId}`,
                            {
                                method: "PUT",

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
                            "Vehicle updated successfully!";

                        message.style.color =
                            "green";


                        setTimeout(
                            () => {

                                closeVehicleForm();

                                loadVehicles();

                            },
                            700
                        );

                    }

                    else {

                        message.textContent =
                            result.message ||
                            "Unable to update vehicle.";

                        message.style.color =
                            "red";

                    }

                }

                catch (error) {

                    console.error(
                        error
                    );


                    message.textContent =
                        "Unable to update vehicle.";

                    message.style.color =
                        "red";

                }


                return;

            }


            // ==========================
            // ADD
            // ==========================

            try {

                const response =
                    await fetch(
                        `${API_URL}/api/vehicles`,
                        {
                            method: "POST",

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
                        "Vehicle added successfully!";

                    message.style.color =
                        "green";


                    this.reset();


                    setTimeout(
                        () => {

                            closeVehicleForm();

                            loadVehicles();

                        },
                        700
                    );

                }

                else {

                    message.textContent =
                        result.message ||
                        "Unable to add vehicle.";

                    message.style.color =
                        "red";

                }

            }

            catch (error) {

                console.error(
                    error
                );


                message.textContent =
                    "Unable to connect to server.";

                message.style.color =
                    "red";

            }

        }
    );

}


// ==========================
// EDIT VEHICLE
// ==========================

async function editVehicle(
    id
) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${id}`,
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

            alert(
                result.message ||
                "Vehicle not found."
            );

            return;

        }


        const vehicle =
            result.vehicle;


        document.getElementById(
            "vehicle_number"
        ).value =
            vehicle.vehicle_number || "";


        document.getElementById(
            "make"
        ).value =
            vehicle.make || "";


        document.getElementById(
            "model"
        ).value =
            vehicle.model || "";


        document.getElementById(
            "manufacturing_year"
        ).value =
            vehicle.manufacturing_year || "";


        document.getElementById(
            "fuel_type"
        ).value =
            vehicle.fuel_type || "";


        document.getElementById(
            "current_km"
        ).value =
            vehicle.current_km || 0;


        document.getElementById(
            "purchase_date"
        ).value =
            vehicle.purchase_date || "";


        document.getElementById(
            "addVehicleForm"
        ).dataset.editId =
            id;


        document.querySelector(
            "#addVehicleForm button[type='submit']"
        ).textContent =
            "Update Vehicle";


        openVehicleForm();

    }

    catch (error) {

        console.error(
            error
        );


        alert(
            "Unable to load vehicle."
        );

    }

}


// ==========================
// VIEW VEHICLE
// ==========================

function viewVehicle(
    id
) {

    window.location.href =
        `vehicle-details.html?id=${id}`;

}


// ==========================
// DELETE VEHICLE
// ==========================

async function deleteVehicle(
    id
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this vehicle?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${id}`,
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
                "Vehicle deleted successfully."
            );


            loadVehicles();

        }

        else {

            alert(
                result.message ||
                "Unable to delete vehicle."
            );

        }

    }

    catch (error) {

        console.error(
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

loadVehicles();