const API_URL = "https://vehiclecare-api.onrender.com";

const token =
    localStorage.getItem("token");

const params =
    new URLSearchParams(
        window.location.search
    );

const vehicleId =
    params.get("id");


if (!token) {
    window.location.href = "login.html";
}


if (!vehicleId) {
    alert("Vehicle ID is missing.");
    window.location.href = "vehicles.html";
}


// ==========================
// HELPERS
// ==========================

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function statusText(status) {

    if (status === "OVERDUE") {
        return "🔴 Expired";
    }

    if (status === "DUE_SOON") {
        return "🟡 Expires Soon";
    }

    return "🟢 Valid";
}


function statusClass(status) {

    if (status === "OVERDUE") {
        return "document-overdue";
    }

    if (status === "DUE_SOON") {
        return "document-due";
    }

    return "document-valid";
}


// ==========================
// LOAD VEHICLE
// ==========================

async function loadVehicle() {

    try {

        const response = await fetch(
            `${API_URL}/api/vehicles/${vehicleId}`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );


        if (!response.ok) {
            throw new Error(
                "Unable to load vehicle"
            );
        }


        const result =
            await response.json();


        const vehicle =
            result.vehicle || result;


        document.getElementById(
            "vehicleInfo"
        ).textContent =
            `${vehicle.make || ""} ${vehicle.model || ""} - ${vehicle.vehicle_number || ""}`;


    } catch (error) {

        console.error(error);

        document.getElementById(
            "vehicleInfo"
        ).textContent =
            "Vehicle information unavailable.";
    }
}


// ==========================
// LOAD DOCUMENTS
// ==========================

async function loadDocuments() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${vehicleId}/documents`,
                {
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
                "Unable to load documents."
            );

            return;
        }


        for (
            const document of result.documents
        ) {

            fillDocument(document);

        }


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server."
        );
    }
}


// ==========================
// FILL DOCUMENT
// ==========================

function fillDocument(doc) {

    const isInsurance =
        doc.document_type === "INSURANCE";

    const prefix =
        isInsurance
            ? "insurance"
            : "puc";


    document.getElementById(
        `${prefix}Number`
    ).value =
        doc.document_number || "";


    document.getElementById(
        `${prefix}Provider`
    ).value =
        doc.provider || "";


    document.getElementById(
        `${prefix}IssueDate`
    ).value =
        doc.issue_date || "";


    document.getElementById(
        `${prefix}ExpiryDate`
    ).value =
        doc.expiry_date || "";


    const status =
        document.getElementById(
            `${prefix}Status`
        );


    status.textContent =
        statusText(
            doc.status
        );


    status.className =
        `document-status ${
            statusClass(
                doc.status
            )
        }`;


    const fileElement =
        document.getElementById(
            `${prefix}FileName`
        );


    fileElement.innerHTML = "";


    if (doc.file_name) {

        fileElement.innerHTML =
            `Attached: ${escapeHtml(
                doc.file_name
            )} `;


        const viewButton =
            document.createElement(
                "button"
            );


        viewButton.type = "button";

        viewButton.className =
            "secondary-btn";

        viewButton.textContent =
            "View Document";


        viewButton.onclick =
            function () {

                downloadDocument(
                    doc.id
                );

            };


        fileElement.appendChild(
            viewButton
        );


    } else {

        fileElement.textContent =
            "No document file attached.";

    }

}


// ==========================
// SAVE DOCUMENT
// ==========================

async function saveDocument(type) {

    const prefix =
        type === "INSURANCE"
            ? "insurance"
            : "puc";


    const formData =
        new FormData();


    formData.append(
        "document_type",
        type
    );


    formData.append(
        "document_number",
        document.getElementById(
            `${prefix}Number`
        ).value
    );


    formData.append(
        "provider",
        document.getElementById(
            `${prefix}Provider`
        ).value
    );


    formData.append(
        "issue_date",
        document.getElementById(
            `${prefix}IssueDate`
        ).value
    );


    formData.append(
        "expiry_date",
        document.getElementById(
            `${prefix}ExpiryDate`
        ).value
    );


    const file =
        document.getElementById(
            `${prefix}File`
        ).files[0];


    if (file) {

        formData.append(
            "document_file",
            file
        );
    }


    const message =
        document.getElementById(
            `${prefix}Message`
        );


    message.textContent =
        "Saving...";

    message.style.color =
        "#2563eb";


    try {

        const response =
            await fetch(
                `${API_URL}/api/vehicles/${vehicleId}/documents`,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: formData
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.textContent =
                result.message ||
                "Unable to save.";

            message.style.color =
                "red";

            return;
        }


        message.textContent =
            result.message;

        message.style.color =
            "green";


        await loadDocuments();


    } catch (error) {

        console.error(error);


        message.textContent =
            "Unable to connect to server.";

        message.style.color =
            "red";
    }
}


// ==========================
// DELETE DOCUMENT
// ==========================

async function deleteDocument(type) {

    if (
        !confirm(
            `Delete ${type} document?`
        )
    ) {

        return;
    }


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


        const document =
            result.documents.find(
                item =>
                    item.document_type === type
            );


        if (!document) {

            alert(
                `${type} document is not added.`
            );

            return;
        }


        const deleteResponse =
            await fetch(
                `${API_URL}/api/documents/${document.id}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const deleteResult =
            await deleteResponse.json();


        if (!deleteResponse.ok) {

            alert(
                deleteResult.message ||
                "Unable to delete document."
            );

            return;
        }


        alert(
            `${type} deleted successfully.`
        );


        window.location.reload();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server."
        );
    }
}


// ==========================
// VIEW DOCUMENT
// ==========================

async function downloadDocument(
    documentId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/documents/${documentId}/download`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!response.ok) {

            const result =
                await response.json();


            alert(
                result.message ||
                "Unable to open document."
            );

            return;
        }


        const blob =
            await response.blob();


        const url =
            URL.createObjectURL(blob);


        window.open(
            url,
            "_blank"
        );


        setTimeout(
            function () {

                URL.revokeObjectURL(url);

            },
            60000
        );


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server."
        );
    }
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
// INSURANCE FORM
// ==========================

const insuranceForm =
    document.getElementById(
        "insuranceForm"
    );


if (insuranceForm) {

    insuranceForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            saveDocument(
                "INSURANCE"
            );

        }
    );
}


// ==========================
// PUC FORM
// ==========================

const pucForm =
    document.getElementById(
        "pucForm"
    );


if (pucForm) {

    pucForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            saveDocument(
                "PUC"
            );

        }
    );
}


// ==========================
// INITIAL LOAD
// ==========================

loadVehicle();

loadDocuments();