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


const params =
    new URLSearchParams(
        window.location.search
    );


const vehicleId =
    params.get("id");


if (!vehicleId) {

    showError();

}

else {

    loadVehicle();

}


// ==========================
// LOAD VEHICLE
// ==========================

async function loadVehicle() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${vehicleId}`,
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

            showError();

            return;

        }


        const vehicle =
            result.vehicle;


        // ==========================
        // VEHICLE INFORMATION
        // ==========================

        document.getElementById(
            "vehicleName"
        ).textContent =
            `${vehicle.make || ""} ${vehicle.model || ""}`.trim();


        document.getElementById(
            "vehicleNumber"
        ).textContent =
            vehicle.vehicle_number ||
            "-";


        document.getElementById(
            "make"
        ).textContent =
            vehicle.make ||
            "N/A";


        document.getElementById(
            "model"
        ).textContent =
            vehicle.model ||
            "N/A";


        document.getElementById(
            "year"
        ).textContent =
            vehicle.manufacturing_year ||
            "N/A";


        document.getElementById(
            "fuel"
        ).textContent =
            vehicle.fuel_type ||
            "N/A";


        document.getElementById(
            "km"
        ).textContent =
            `${vehicle.current_km || 0} KM`;


        document.getElementById(
            "purchaseDate"
        ).textContent =
            vehicle.purchase_date ||
            "N/A";


        // ==========================
        // SHOW PAGE
        // ==========================

        document.getElementById(
            "loading"
        ).style.display =
            "none";


        document.getElementById(
            "vehicleDetails"
        ).style.display =
            "block";


        // ==========================
        // EDIT
        // ==========================

        document.getElementById(
            "editButton"
        ).onclick =
            function() {

                window.location.href =
                    `vehicles.html?edit=${vehicle.id}`;

            };


        // ==========================
        // DELETE
        // ==========================

        document.getElementById(
            "deleteButton"
        ).onclick =
            function() {

                deleteVehicle(
                    vehicle.id
                );

            };


        // ==========================
        // SERVICES
        // ==========================

        document.getElementById(
            "serviceButton"
        ).onclick =
            function() {

                window.location.href =
                    `services.html?id=${vehicle.id}`;

            };


        // ==========================
        // DOCUMENTS
        // ==========================

        const documentButton =
            document.getElementById(
                "documentButton"
            );


        if (documentButton) {

            documentButton.onclick =
                function() {

                    window.location.href =
                        `documents.html?id=${vehicle.id}`;

                };

        }


        // ==========================
        // LOAD SERVICE SUMMARY
        // ==========================

        await loadServiceSummary();


        // ==========================
        // LOAD DOCUMENT SUMMARY
        // ==========================

        await loadDocumentSummary();

    }

    catch (error) {

        console.error(
            "Vehicle loading error:",
            error
        );


        showError();

    }

}


// ==========================
// LOAD SERVICE SUMMARY
// ==========================

async function loadServiceSummary() {

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


        if (!response.ok) {

            console.error(
                "Unable to load services."
            );

            return;

        }


        const result =
            await response.json();


        const services =
            result.services ||
            result.data ||
            [];


        // ==========================
        // COUNTS
        // ==========================

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
                        service.status ||
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
            "totalServices"
        ).textContent =
            services.length;


        document.getElementById(
            "overdueServices"
        ).textContent =
            overdue;


        document.getElementById(
            "dueSoonServices"
        ).textContent =
            dueSoon;


        document.getElementById(
            "upcomingServices"
        ).textContent =
            upcoming;


        // ==========================
        // NEXT SERVICE
        // ==========================

        if (!services.length) {

            setNextService(
                null
            );

            return;

        }


        const sorted =
            [...services].sort(
                compareServiceDates
            );


        const nextService =
            sorted.find(
                service =>
                    service.status !==
                    "OVERDUE"
            ) ||
            sorted[0];


        setNextService(
            nextService
        );

    }

    catch (error) {

        console.error(
            "Service summary error:",
            error
        );

    }

}


// ==========================
// COMPARE SERVICE DATES
// ==========================

function compareServiceDates(
    a,
    b
) {

    const dateA =
        new Date(
            a.next_service_date ||
            a.service_date ||
            "9999-12-31"
        );


    const dateB =
        new Date(
            b.next_service_date ||
            b.service_date ||
            "9999-12-31"
        );


    return dateA - dateB;

}


// ==========================
// DISPLAY NEXT SERVICE
// ==========================

function setNextService(
    service
) {

    const type =
        document.getElementById(
            "nextServiceType"
        );


    const date =
        document.getElementById(
            "nextServiceDate"
        );


    const km =
        document.getElementById(
            "nextServiceKm"
        );


    if (!service) {

        type.textContent =
            "Not scheduled";


        date.textContent =
            "Not scheduled";


        km.textContent =
            "Not scheduled";


        return;

    }


    type.textContent =
        service.service_type ||
        service.name ||
        "Service";


    date.textContent =
        service.next_service_date ||
        service.service_date ||
        "Not set";


    km.textContent =
        service.next_service_km
            ? `${service.next_service_km} KM`
            : "Not set";

}


// ==========================
// LOAD DOCUMENT SUMMARY
// ==========================

async function loadDocumentSummary() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${vehicleId}/documents`,
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
                result.message ||
                "Unable to load documents."
            );

            return;

        }


        const documents =
            result.documents ||
            [];


        const insurance =
            documents.find(
                item =>
                    item.document_type ===
                    "INSURANCE"
            );


        const puc =
            documents.find(
                item =>
                    item.document_type ===
                    "PUC"
            );


        displayInsurance(
            insurance
        );


        displayPUC(
            puc
        );

    }

    catch (error) {

        console.error(
            "Document loading error:",
            error
        );

    }

}


// ==========================
// DISPLAY INSURANCE
// ==========================

function displayInsurance(
    insurance
) {

    const number =
        document.getElementById(
            "insuranceNumber"
        );


    const provider =
        document.getElementById(
            "insuranceProvider"
        );


    const expiry =
        document.getElementById(
            "insuranceExpiry"
        );


    const status =
        document.getElementById(
            "insuranceStatus"
        );


    if (!insurance) {

        number.textContent =
            "Not added";


        provider.textContent =
            "Not added";


        expiry.textContent =
            "Not added";


        status.className =
            "document-status-badge status-not-added";


        status.textContent =
            "⚪ Not Added";


        return;

    }


    number.textContent =
        insurance.document_number ||
        "Not provided";


    provider.textContent =
        insurance.provider ||
        "Not provided";


    expiry.textContent =
        insurance.expiry_date ||
        "Not provided";


    setDocumentStatus(
        status,
        insurance.status
    );

}


// ==========================
// DISPLAY PUC
// ==========================

function displayPUC(
    puc
) {

    const number =
        document.getElementById(
            "pucNumber"
        );


    const provider =
        document.getElementById(
            "pucProvider"
        );


    const expiry =
        document.getElementById(
            "pucExpiry"
        );


    const status =
        document.getElementById(
            "pucStatus"
        );


    if (!puc) {

        number.textContent =
            "Not added";


        provider.textContent =
            "Not added";


        expiry.textContent =
            "Not added";


        status.className =
            "document-status-badge status-not-added";


        status.textContent =
            "⚪ Not Added";


        return;

    }


    number.textContent =
        puc.document_number ||
        "Not provided";


    provider.textContent =
        puc.provider ||
        "Not provided";


    expiry.textContent =
        puc.expiry_date ||
        "Not provided";


    setDocumentStatus(
        status,
        puc.status
    );

}


// ==========================
// DOCUMENT STATUS
// ==========================

function setDocumentStatus(
    element,
    status
) {

    element.className =
        "document-status-badge";


    if (
        status ===
        "OVERDUE"
    ) {

        element.classList.add(
            "status-overdue"
        );


        element.textContent =
            "🔴 Expired";


        return;

    }


    if (
        status ===
        "DUE_SOON"
    ) {

        element.classList.add(
            "status-due"
        );


        element.textContent =
            "🟡 Expires Soon";


        return;

    }


    element.classList.add(
        "status-valid"
    );


    element.textContent =
        "🟢 Valid";

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


            window.location.href =
                "vehicles.html";

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
// ERROR
// ==========================

function showError() {

    const loading =
        document.getElementById(
            "loading"
        );


    const details =
        document.getElementById(
            "vehicleDetails"
        );


    const error =
        document.getElementById(
            "error"
        );


    if (loading) {

        loading.style.display =
            "none";

    }


    if (details) {

        details.style.display =
            "none";

    }


    if (error) {

        error.style.display =
            "block";

    }

}


// ==========================
// BACK
// ==========================

function goBack() {

    window.location.href =
        "vehicles.html";

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