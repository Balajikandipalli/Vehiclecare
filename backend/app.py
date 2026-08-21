from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from flask_mail import Mail, Message
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text
from datetime import datetime, date, timedelta
import os

load_dotenv()

app = Flask(__name__)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
CORS(app)

# =========================
# DOCUMENT UPLOADS
# =========================

DOCUMENT_UPLOAD_DIR = os.path.join(
    app.root_path,
    "uploads",
    "documents"
)

os.makedirs(
    DOCUMENT_UPLOAD_DIR,
    exist_ok=True
)

ALLOWED_DOCUMENT_EXTENSIONS = {
    "pdf",
    "png",
    "jpg",
    "jpeg"
}


def allowed_document_file(filename):

    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_DOCUMENT_EXTENSIONS
    )

# =========================
# CONFIGURATION
# =========================

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///vehiclecare.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY",
    "vehiclecare-super-secret-key"
)

# =========================
# EMAIL CONFIGURATION
# =========================

app.config["MAIL_SERVER"] = os.getenv(
    "MAIL_SERVER",
    "smtp.gmail.com"
)

app.config["MAIL_PORT"] = int(
    os.getenv("MAIL_PORT", "587")
)

app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USE_SSL"] = False

app.config["MAIL_USERNAME"] = os.getenv(
    "MAIL_USERNAME"
)

app.config["MAIL_PASSWORD"] = os.getenv(
    "MAIL_PASSWORD"
)

app.config["MAIL_DEFAULT_SENDER"] = os.getenv(
    "MAIL_FROM",
    os.getenv("MAIL_USERNAME")
)

db = SQLAlchemy(app)
jwt = JWTManager(app)
mail = Mail(app)


# =========================
# AUTOMATIC REMINDER SCHEDULER
# =========================

REMINDER_HOUR = int(
    os.getenv("REMINDER_HOUR", "9")
)

REMINDER_MINUTE = int(
    os.getenv("REMINDER_MINUTE", "0")
)

scheduler = BackgroundScheduler()


def send_document_reminder_email(
    user,
    vehicle,
    document,
    reminder_status
):
    if not user.email:
        return False, "User email is missing"

    if reminder_status not in [
        "DUE_SOON",
        "OVERDUE"
    ]:
        return False, "No email required for this status"

    today = date.today().isoformat()

    # Prevent duplicate reminder emails on the same day
    if (
        document.last_reminder_date == today
        and document.last_reminder_status == reminder_status
    ):
        return False, "Reminder already sent today"

    if reminder_status == "OVERDUE":
        subject = (
            f"VehicleCare - {document.document_type} is Overdue"
        )
        status_text = "OVERDUE"
    else:
        subject = (
            f"VehicleCare - {document.document_type} is Due Soon"
        )
        status_text = "DUE SOON"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>VehicleCare Document Reminder</title>
    </head>

    <body style="
        margin:0;
        padding:30px;
        background:#f8fafc;
        font-family:Arial,Helvetica,sans-serif;
    ">

        <div style="
            max-width:600px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:14px;
            border:1px solid #e5e7eb;
        ">

            <h1 style="
                margin-top:0;
                color:#2563eb;
            ">
                VehicleCare 🚗
            </h1>

            <h2>
                Document Reminder
            </h2>

            <p>
                Hello {user.name},
            </p>

            <p>
                Your vehicle document requires your attention.
            </p>

            <div style="
                background:#f8fafc;
                padding:20px;
                border-radius:10px;
                margin:20px 0;
            ">

                <p>
                    <strong>Vehicle:</strong>
                    {vehicle.make} {vehicle.model}
                </p>

                <p>
                    <strong>Vehicle Number:</strong>
                    {vehicle.vehicle_number}
                </p>

                <p>
                    <strong>Document:</strong>
                    {document.document_type}
                </p>

                <p>
                    <strong>Document Number:</strong>
                    {document.document_number or "Not provided"}
                </p>

                <p>
                    <strong>Provider:</strong>
                    {document.provider or "Not provided"}
                </p>

                <p>
                    <strong>Expiry Date:</strong>
                    {document.expiry_date}
                </p>

                <p>
                    <strong>Status:</strong>
                    {status_text}
                </p>

            </div>

            <p>
                Please take the necessary action before the document expires.
            </p>

            <hr>

            <p style="
                color:#64748b;
                font-size:13px;
            ">
                This is an automatic reminder from VehicleCare.
            </p>

        </div>

    </body>
    </html>
    """

    try:
        message = Message(
            subject=subject,
            recipients=[user.email],
            html=html
        )

        mail.send(message)

        # Update last reminder information
        document.last_reminder_date = today
        document.last_reminder_status = reminder_status

        db.session.commit()

        # Save notification history
        save_notification_history(
            user=user,
            vehicle=vehicle,
            document=document,
            notification_type="DOCUMENT",
            reminder_status=reminder_status,
            recipient=user.email,
            subject=subject,
            status="SENT"
        )

        return True, "Email sent successfully"

    except Exception as error:
        db.session.rollback()

        print(
            "Document email error:",
            error
        )

        return False, str(error)

def automatic_reminder_job():
    """
    Runs automatically every day and checks all users,
    vehicles and services for DUE_SOON / OVERDUE reminders.
    """

    with app.app_context():

        users = User.query.all()

        total_sent = 0
        total_skipped = 0

        for user in users:

            if not user.email:
                continue

            vehicles = Vehicle.query.filter_by(
                user_id=user.id
            ).all()

            for vehicle in vehicles:

                services = Service.query.filter_by(
                    vehicle_id=vehicle.id
                ).all()

                for service in services:

                    reminder_status = calculate_service_status(
                        next_service_date=service.next_service_date,
                        next_service_km=service.next_service_km,
                        current_km=vehicle.current_km
                    )

                    if reminder_status not in [
                        "DUE_SOON",
                        "OVERDUE"
                    ]:
                        continue

                    email_sent, message = send_service_reminder_email(
                        user,
                        vehicle,
                        service,
                        reminder_status
                    )

                    if email_sent:
                        total_sent += 1
                        print(
                            f"Reminder sent: "
                            f"{user.email} | "
                            f"{vehicle.vehicle_number} | "
                            f"{reminder_status}"
                        )
                    else:
                        total_skipped += 1
                        print(
                            f"Reminder skipped: "
                            f"{user.email} | "
                            f"{vehicle.vehicle_number} | "
                            f"{message}"
                        )

        # Check insurance and PUC documents.
        for user in users:

            if not user.email:
                continue

            vehicles = Vehicle.query.filter_by(
                user_id=user.id
            ).all()

            for vehicle in vehicles:

                documents = VehicleDocument.query.filter_by(
                    vehicle_id=vehicle.id
                ).all()

                for document in documents:

                    document_status = calculate_document_status(
                        document.expiry_date
                    )

                    if document_status not in [
                        "DUE_SOON",
                        "OVERDUE"
                    ]:
                        continue

                    email_sent, message = (
                        send_document_reminder_email(
                            user,
                            vehicle,
                            document,
                            document_status
                        )
                    )

                    if email_sent:
                        total_sent += 1
                    else:
                        total_skipped += 1

        print(
            "Automatic reminder check completed. "
            f"Sent={total_sent}, "
            f"Skipped={total_skipped}"
        )


def start_reminder_scheduler():

    if scheduler.running:
        return

    scheduler.add_job(
        automatic_reminder_job,
        trigger="cron",
        hour=REMINDER_HOUR,
        minute=REMINDER_MINUTE,
        id="daily_vehiclecare_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )

    scheduler.start()

    print(
        "Automatic reminder scheduler started: "
        f"{REMINDER_HOUR:02d}:{REMINDER_MINUTE:02d} daily"
    )


# =========================
# USER MODEL
# =========================

class User(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    email = db.Column(
        db.String(120),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(255),
        nullable=False
    )

    phone = db.Column(
        db.String(20)
    )

    role = db.Column(
        db.String(20),
        default="user"
    )


# =========================
# VEHICLE MODEL
# =========================

class Vehicle(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False
    )

    vehicle_number = db.Column(
        db.String(30),
        nullable=False
    )

    make = db.Column(
        db.String(50),
        nullable=False
    )

    model = db.Column(
        db.String(50),
        nullable=False
    )

    manufacturing_year = db.Column(
        db.Integer
    )

    fuel_type = db.Column(
        db.String(20)
    )

    current_km = db.Column(
        db.Integer,
        default=0
    )

    purchase_date = db.Column(
        db.String(20)
    )


# =========================
# SERVICE MODEL
# =========================

class Service(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicle.id"),
        nullable=False
    )

    service_type = db.Column(
        db.String(100),
        nullable=False
    )

    service_date = db.Column(
        db.String(20),
        nullable=False
    )

    service_km = db.Column(
        db.Integer,
        default=0
    )

    next_service_date = db.Column(
        db.String(20)
    )

    next_service_km = db.Column(
        db.Integer
    )

    cost = db.Column(
        db.Float,
        default=0
    )

    service_center = db.Column(
        db.String(150)
    )

    notes = db.Column(
        db.Text
    )

    status = db.Column(
        db.String(30),
        default="Completed"
    )

    last_reminder_date = db.Column(
        db.String(20),
        nullable=True
    )

    last_reminder_status = db.Column(
        db.String(30),
        nullable=True
    )


# =========================
# VEHICLE DOCUMENT MODEL
# =========================

class VehicleDocument(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicle.id"),
        nullable=False
    )

    document_type = db.Column(
        db.String(30),
        nullable=False
    )

    document_number = db.Column(
        db.String(100)
    )

    provider = db.Column(
        db.String(150)
    )

    issue_date = db.Column(
        db.String(20)
    )

    expiry_date = db.Column(
        db.String(20),
        nullable=False
    )

    file_name = db.Column(
        db.String(255)
    )

    file_path = db.Column(
        db.String(500)
    )

    last_reminder_date = db.Column(
        db.String(20),
        nullable=True
    )

    last_reminder_status = db.Column(
        db.String(30),
        nullable=True
    )

    # ==================================================
# NOTIFICATION HISTORY MODEL
# ==================================================

class NotificationHistory(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False
    )

    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicle.id"),
        nullable=True
    )

    service_id = db.Column(
        db.Integer,
        db.ForeignKey("service.id"),
        nullable=True
    )

    document_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicle_document.id"),
        nullable=True
    )

    notification_type = db.Column(
        db.String(30),
        nullable=False
    )

    reminder_status = db.Column(
        db.String(30),
        nullable=False
    )

    recipient = db.Column(
        db.String(150),
        nullable=False
    )

    subject = db.Column(
        db.String(255),
        nullable=False
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="SENT"
    )

    error_message = db.Column(
        db.Text,
        nullable=True
    )

    sent_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


# =========================
# CREATE DATABASE
# =========================

with app.app_context():
    db.create_all()

    # Safe SQLite migration for existing databases.
    # This preserves existing users, vehicles and services.
    try:
        result = db.session.execute(
            text("PRAGMA table_info(service)")
        )

        service_columns = {
            row[1]
            for row in result
        }

        if "last_reminder_date" not in service_columns:
            db.session.execute(
                text("""
                    ALTER TABLE service
                    ADD COLUMN last_reminder_date VARCHAR(20)
                """)
            )

        if "last_reminder_status" not in service_columns:
            db.session.execute(
                text("""
                    ALTER TABLE service
                    ADD COLUMN last_reminder_status VARCHAR(30)
                """)
            )

        # Vehicle document table is created by db.create_all().
        # The following check keeps this startup migration safe
        # for older installations.
        db.session.commit()

    except Exception as error:
        db.session.rollback()
        print(
            "Database migration warning:",
            error
        )


# =========================
# HOME
# =========================

@app.route("/")
def home():

    return jsonify({
        "success": True,
        "message": "VehicleCare API is running 🚗",
        "version": "1.0.0"
    })


# =========================
# HEALTH CHECK
# =========================

@app.route("/api/health")
def health():

    return jsonify({
        "status": "healthy",
        "message": "Backend is working"
    })


# =========================
# REGISTER
# =========================

@app.route(
    "/api/auth/register",
    methods=["POST"]
)
def register():

    data = request.get_json()

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")

    if not name or not email or not password:

        return jsonify({
            "success": False,
            "message": "Name, email and password are required"
        }), 400

    email = email.lower().strip()

    existing_user = User.query.filter_by(
        email=email
    ).first()

    if existing_user:

        return jsonify({
            "success": False,
            "message": "Email already registered"
        }), 409

    user = User(
        name=name.strip(),
        email=email,
        password=generate_password_hash(password),
        phone=phone
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role
        }
    }), 201


# =========================
# LOGIN
# =========================

@app.route(
    "/api/auth/login",
    methods=["POST"]
)
def login():

    data = request.get_json()

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:

        return jsonify({
            "success": False,
            "message": "Email and password are required"
        }), 400

    email = email.lower().strip()

    user = User.query.filter_by(
        email=email
    ).first()

    if not user or not check_password_hash(
        user.password,
        password
    ):

        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401

    token = create_access_token(
        identity=str(user.id)
    )

    return jsonify({
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role
        }
    })


# =========================
# CURRENT USER
# =========================

@app.route("/api/auth/me")
@jwt_required()
def current_user():

    user_id = int(get_jwt_identity())

    user = db.session.get(
        User,
        user_id
    )

    if not user:

        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role
        }
    })


# ==================================================
# VEHICLE APIs
# ==================================================


# =========================
# ADD VEHICLE
# =========================

@app.route(
    "/api/vehicles",
    methods=["POST"]
)
@jwt_required()
def add_vehicle():

    user_id = int(get_jwt_identity())

    data = request.get_json()

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    vehicle_number = data.get("vehicle_number")
    make = data.get("make")
    model = data.get("model")

    if not vehicle_number or not make or not model:

        return jsonify({
            "success": False,
            "message": "Vehicle number, make and model are required"
        }), 400

    vehicle = Vehicle(
        user_id=user_id,
        vehicle_number=vehicle_number.strip().upper(),
        make=make.strip(),
        model=model.strip(),
        manufacturing_year=data.get("manufacturing_year"),
        fuel_type=data.get("fuel_type"),
        current_km=data.get("current_km", 0),
        purchase_date=data.get("purchase_date")
    )

    db.session.add(vehicle)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Vehicle added successfully",
        "vehicle": {
            "id": vehicle.id,
            "vehicle_number": vehicle.vehicle_number,
            "make": vehicle.make,
            "model": vehicle.model,
            "manufacturing_year": vehicle.manufacturing_year,
            "fuel_type": vehicle.fuel_type,
            "current_km": vehicle.current_km,
            "purchase_date": vehicle.purchase_date
        }
    }), 201


# =========================
# GET ALL VEHICLES
# =========================

@app.route(
    "/api/vehicles",
    methods=["GET"]
)
@jwt_required()
def get_vehicles():

    user_id = int(get_jwt_identity())

    vehicles = Vehicle.query.filter_by(
        user_id=user_id
    ).all()

    result = []

    for vehicle in vehicles:

        result.append({
            "id": vehicle.id,
            "vehicle_number": vehicle.vehicle_number,
            "make": vehicle.make,
            "model": vehicle.model,
            "manufacturing_year": vehicle.manufacturing_year,
            "fuel_type": vehicle.fuel_type,
            "current_km": vehicle.current_km,
            "purchase_date": vehicle.purchase_date
        })

    return jsonify({
        "success": True,
        "vehicles": result
    })


# =========================
# GET ONE VEHICLE
# =========================

@app.route(
    "/api/vehicles/<int:vehicle_id>",
    methods=["GET"]
)
@jwt_required()
def get_vehicle(vehicle_id):

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    return jsonify({
        "success": True,
        "vehicle": {
            "id": vehicle.id,
            "vehicle_number": vehicle.vehicle_number,
            "make": vehicle.make,
            "model": vehicle.model,
            "manufacturing_year": vehicle.manufacturing_year,
            "fuel_type": vehicle.fuel_type,
            "current_km": vehicle.current_km,
            "purchase_date": vehicle.purchase_date
        }
    })


# =========================
# UPDATE VEHICLE
# =========================

@app.route(
    "/api/vehicles/<int:vehicle_id>",
    methods=["PUT"]
)
@jwt_required()
def update_vehicle(vehicle_id):

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    data = request.get_json()

    if "vehicle_number" in data:
        vehicle.vehicle_number = (
            data["vehicle_number"].strip().upper()
        )

    if "make" in data:
        vehicle.make = data["make"].strip()

    if "model" in data:
        vehicle.model = data["model"].strip()

    if "manufacturing_year" in data:
        vehicle.manufacturing_year = data["manufacturing_year"]

    if "fuel_type" in data:
        vehicle.fuel_type = data["fuel_type"]

    if "current_km" in data:
        vehicle.current_km = data["current_km"]

    if "purchase_date" in data:
        vehicle.purchase_date = data["purchase_date"]

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Vehicle updated successfully"
    })


# =========================
# DELETE VEHICLE
# =========================

@app.route(
    "/api/vehicles/<int:vehicle_id>",
    methods=["DELETE"]
)
@jwt_required()
def delete_vehicle(vehicle_id):

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    db.session.delete(vehicle)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Vehicle deleted successfully"
    })
# ==================================================
# VEHICLE DOCUMENT REMINDER STATUS
# ==================================================

def calculate_document_status(expiry_date):

    if not expiry_date:
        return "UPCOMING"

    try:

        expiry = datetime.strptime(
            expiry_date,
            "%Y-%m-%d"
        ).date()

        days_left = (
            expiry - date.today()
        ).days

        if days_left < 0:
            return "OVERDUE"

        if days_left <= 30:
            return "DUE_SOON"

        return "UPCOMING"

    except ValueError:

        return "UPCOMING"


# ==================================================
# VEHICLE DOCUMENT APIs
# ==================================================

@app.route(
    "/api/vehicles/<int:vehicle_id>/documents",
    methods=["GET"]
)
@jwt_required()
def get_vehicle_documents(vehicle_id):

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    documents = VehicleDocument.query.filter_by(
        vehicle_id=vehicle_id
    ).order_by(
        VehicleDocument.expiry_date.asc()
    ).all()

    return jsonify({
        "success": True,
        "documents": [
            {
                "id": document.id,
                "vehicle_id": document.vehicle_id,
                "document_type": document.document_type,
                "document_number": document.document_number,
                "provider": document.provider,
                "issue_date": document.issue_date,
                "expiry_date": document.expiry_date,
                "file_name": document.file_name,
                "status": calculate_document_status(
                    document.expiry_date
                )
            }
            for document in documents
        ]
    })


@app.route(
    "/api/vehicles/<int:vehicle_id>/documents",
    methods=["POST"]
)
@jwt_required()
def add_or_update_vehicle_document(vehicle_id):

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    document_type = (
        request.form.get("document_type")
        or ""
    ).strip().upper()

    if document_type not in [
        "INSURANCE",
        "PUC"
    ]:

        return jsonify({
            "success": False,
            "message":
                "Document type must be INSURANCE or PUC"
        }), 400

    expiry_date = (
        request.form.get("expiry_date")
        or ""
    ).strip()

    if not expiry_date:

        return jsonify({
            "success": False,
            "message": "Expiry date is required"
        }), 400

    try:

        datetime.strptime(
            expiry_date,
            "%Y-%m-%d"
        )

    except ValueError:

        return jsonify({
            "success": False,
            "message":
                "Expiry date must be YYYY-MM-DD"
        }), 400

    # Keep one current record per document type.
    document = VehicleDocument.query.filter_by(
        vehicle_id=vehicle_id,
        document_type=document_type
    ).first()

    if not document:

        document = VehicleDocument(
            vehicle_id=vehicle_id,
            document_type=document_type
        )

        db.session.add(document)

    document.document_number = (
        request.form.get("document_number")
        or ""
    ).strip()

    document.provider = (
        request.form.get("provider")
        or ""
    ).strip()

    document.issue_date = (
        request.form.get("issue_date")
        or ""
    ).strip()

    document.expiry_date = expiry_date

    uploaded_file = request.files.get("document_file")

    if uploaded_file and uploaded_file.filename:

        if not allowed_document_file(
            uploaded_file.filename
        ):

            return jsonify({
                "success": False,
                "message":
                    "Only PDF, PNG, JPG and JPEG files are allowed"
            }), 400

        safe_name = secure_filename(
            uploaded_file.filename
        )

        unique_name = (
            f"vehicle_{vehicle_id}_"
            f"{document_type.lower()}_"
            f"{datetime.now().strftime('%Y%m%d%H%M%S')}_"
            f"{safe_name}"
        )

        file_path = os.path.join(
            DOCUMENT_UPLOAD_DIR,
            unique_name
        )

        uploaded_file.save(file_path)

        document.file_name = safe_name
        document.file_path = unique_name

    # Reset reminder tracking whenever the document is updated.
    document.last_reminder_date = None
    document.last_reminder_status = None

    db.session.commit()

    return jsonify({
        "success": True,
        "message":
            f"{document_type} saved successfully",
        "document": {
            "id": document.id,
            "vehicle_id": document.vehicle_id,
            "document_type": document.document_type,
            "document_number":
                document.document_number,
            "provider":
                document.provider,
            "issue_date":
                document.issue_date,
            "expiry_date":
                document.expiry_date,
            "file_name":
                document.file_name,
            "status":
                calculate_document_status(
                    document.expiry_date
                )
        }
    })


@app.route(
    "/api/documents/<int:document_id>",
    methods=["DELETE"]
)
@jwt_required()
def delete_vehicle_document(document_id):

    user_id = int(get_jwt_identity())

    document = db.session.get(
        VehicleDocument,
        document_id
    )

    if not document:

        return jsonify({
            "success": False,
            "message": "Document not found"
        }), 404

    vehicle = Vehicle.query.filter_by(
        id=document.vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Unauthorized"
        }), 403

    if document.file_path:

        file_path = os.path.join(
            DOCUMENT_UPLOAD_DIR,
            document.file_path
        )

        if os.path.exists(file_path):

            try:
                os.remove(file_path)
            except OSError:
                pass

    db.session.delete(document)

    db.session.commit()

    return jsonify({
        "success": True,
        "message":
            "Document deleted successfully"
    })


@app.route(
    "/api/documents/<int:document_id>/download",
    methods=["GET"]
)
@jwt_required()
def download_vehicle_document(document_id):

    user_id = int(get_jwt_identity())

    document = db.session.get(
        VehicleDocument,
        document_id
    )

    if not document:

        return jsonify({
            "success": False,
            "message": "Document not found"
        }), 404

    vehicle = Vehicle.query.filter_by(
        id=document.vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Unauthorized"
        }), 403

    if not document.file_path:

        return jsonify({
            "success": False,
            "message": "No file attached"
        }), 404

    return send_from_directory(
        DOCUMENT_UPLOAD_DIR,
        document.file_path,
        as_attachment=False,
        download_name=document.file_name
            or document.file_path
    )


# ==================================================
# SERVICE REMINDER STATUS
# ==================================================


def calculate_service_status(
    next_service_date=None,
    next_service_km=None,
    current_km=0
):

    today = date.today()

    date_status = "UPCOMING"
    km_status = "UPCOMING"

    # -------------------------
    # DATE CHECK
    # -------------------------

    if next_service_date:

        try:

            service_date = datetime.strptime(
                next_service_date,
                "%Y-%m-%d"
            ).date()

            days_left = (
                service_date - today
            ).days

            if days_left < 0:

                date_status = "OVERDUE"

            elif days_left <= 30:

                date_status = "DUE_SOON"

            else:

                date_status = "UPCOMING"

        except ValueError:

            date_status = "UPCOMING"


    # -------------------------
    # KM CHECK
    # -------------------------

    if next_service_km is not None:

        try:

            km_left = (
                int(next_service_km)
                - int(current_km or 0)
            )

            if km_left <= 0:

                km_status = "OVERDUE"

            elif km_left <= 1000:

                km_status = "DUE_SOON"

            else:

                km_status = "UPCOMING"

        except (ValueError, TypeError):

            km_status = "UPCOMING"


    # -------------------------
    # FINAL STATUS
    # -------------------------

    if (
        date_status == "OVERDUE"
        or km_status == "OVERDUE"
    ):

        return "OVERDUE"


    if (
        date_status == "DUE_SOON"
        or km_status == "DUE_SOON"
    ):

        return "DUE_SOON"


    return "UPCOMING"

# ==================================================
# SERVICE APIs
# ==================================================


# =========================
# ADD SERVICE
# =========================

@app.route(
    "/api/vehicles/<int:vehicle_id>/services",
    methods=["POST"]
)
@jwt_required()
def add_service(vehicle_id):

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    data = request.get_json()

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    service_type = data.get("service_type")
    service_date = data.get("service_date")

    if not service_type or not service_date:

        return jsonify({
            "success": False,
            "message": "Service type and service date are required"
        }), 400

    service = Service(
        vehicle_id=vehicle_id,
        service_type=service_type,
        service_date=service_date,
        service_km=data.get("service_km", 0),
        next_service_date=data.get("next_service_date"),
        next_service_km=data.get("next_service_km"),
        cost=data.get("cost", 0),
        service_center=data.get("service_center"),
        notes=data.get("notes"),
        status=data.get("status", "Completed")
    )

    db.session.add(service)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Service added successfully",
        "service": {
            "id": service.id,
            "vehicle_id": service.vehicle_id,
            "service_type": service.service_type,
            "service_date": service.service_date,
            "service_km": service.service_km,
            "next_service_date": service.next_service_date,
            "next_service_km": service.next_service_km,
            "cost": service.cost,
            "service_center": service.service_center,
            "notes": service.notes,
            "status": service.status
        }
    }), 201


# =========================
# GET SERVICES
# =========================

@app.route(
    "/api/vehicles/<int:vehicle_id>/services",
    methods=["GET"]
)
@jwt_required()
def get_services(vehicle_id):

    user_id = int(get_jwt_identity())

    # Check vehicle belongs to logged-in user
    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    services = Service.query.filter_by(
        vehicle_id=vehicle_id
    ).order_by(
        Service.service_date.desc()
    ).all()

    result = []

    for service in services:

        # Automatically calculate status
        reminder_status = calculate_service_status(
            next_service_date=service.next_service_date,
            next_service_km=service.next_service_km,
            current_km=vehicle.current_km
        )

        result.append({

            "id": service.id,

            "vehicle_id": service.vehicle_id,

            "service_type": service.service_type,

            "service_date": service.service_date,

            "service_km": service.service_km,

            "next_service_date":
                service.next_service_date,

            "next_service_km":
                service.next_service_km,

            "cost": service.cost,

            "service_center":
                service.service_center,

            "notes":
                service.notes,

            # Existing database status
            "status":
                service.status,

            # Automatically calculated status
            "reminder_status":
                reminder_status
        })

    return jsonify({
        "success": True,
        "vehicle": {
            "id": vehicle.id,
            "vehicle_number": vehicle.vehicle_number,
            "make": vehicle.make,
            "model": vehicle.model,
            "current_km": vehicle.current_km
        },
        "services": result
    })

    user_id = int(get_jwt_identity())

    vehicle = Vehicle.query.filter_by(
        id=vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Vehicle not found"
        }), 404

    services = Service.query.filter_by(
        vehicle_id=vehicle_id
    ).order_by(
        Service.service_date.desc()
    ).all()

    result = []

    for service in services:

        result.append({
            "id": service.id,
            "service_type": service.service_type,
            "service_date": service.service_date,
            "service_km": service.service_km,
            "next_service_date": service.next_service_date,
            "next_service_km": service.next_service_km,
            "cost": service.cost,
            "service_center": service.service_center,
            "notes": service.notes,
            "status": service.status
        })

    return jsonify({
        "success": True,
        "services": result
    })


# =========================
# GET ONE SERVICE
# =========================

@app.route(
    "/api/services/<int:service_id>",
    methods=["GET"]
)
@jwt_required()
def get_service(service_id):

    user_id = int(get_jwt_identity())

    service = db.session.get(
        Service,
        service_id
    )

    if not service:

        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    vehicle = Vehicle.query.filter_by(
        id=service.vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    return jsonify({
        "success": True,
        "service": {
            "id": service.id,
            "vehicle_id": service.vehicle_id,
            "service_type": service.service_type,
            "service_date": service.service_date,
            "service_km": service.service_km,
            "next_service_date": service.next_service_date,
            "next_service_km": service.next_service_km,
            "cost": service.cost,
            "service_center": service.service_center,
            "notes": service.notes,
            "status": service.status
        }
    })


# =========================
# UPDATE SERVICE
# =========================

@app.route(
    "/api/services/<int:service_id>",
    methods=["PUT"]
)
@jwt_required()
def update_service(service_id):

    user_id = int(get_jwt_identity())

    service = db.session.get(
        Service,
        service_id
    )

    if not service:

        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    vehicle = Vehicle.query.filter_by(
        id=service.vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    data = request.get_json()

    if "service_type" in data:
        service.service_type = data["service_type"]

    if "service_date" in data:
        service.service_date = data["service_date"]

    if "service_km" in data:
        service.service_km = data["service_km"]

    if "next_service_date" in data:
        service.next_service_date = data["next_service_date"]

    if "next_service_km" in data:
        service.next_service_km = data["next_service_km"]

    if "cost" in data:
        service.cost = data["cost"]

    if "service_center" in data:
        service.service_center = data["service_center"]

    if "notes" in data:
        service.notes = data["notes"]

    if "status" in data:
        service.status = data["status"]

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Service updated successfully"
    })


# =========================
# DELETE SERVICE
# =========================

@app.route(
    "/api/services/<int:service_id>",
    methods=["DELETE"]
)
@jwt_required()
def delete_service(service_id):

    user_id = int(get_jwt_identity())

    service = db.session.get(
        Service,
        service_id
    )

    if not service:

        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    vehicle = Vehicle.query.filter_by(
        id=service.vehicle_id,
        user_id=user_id
    ).first()

    if not vehicle:

        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    db.session.delete(service)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Service deleted successfully"
    })

# ==================================================
# SAVE NOTIFICATION HISTORY
# ==================================================

def save_notification_history(
    user,
    vehicle,
    notification_type,
    reminder_status,
    recipient,
    subject,
    service=None,
    document=None,
    status="SENT",
    error_message=None
):

    try:

        history = NotificationHistory(

            user_id=user.id,

            vehicle_id=(
                vehicle.id
                if vehicle
                else None
            ),

            service_id=(
                service.id
                if service
                else None
            ),

            document_id=(
                document.id
                if document
                else None
            ),

            notification_type=
                notification_type,

            reminder_status=
                reminder_status,

            recipient=
                recipient,

            subject=
                subject,

            status=
                status,

            error_message=
                error_message,

            sent_at=
                datetime.utcnow()
        )

        db.session.add(history)

        db.session.commit()

        return True

    except Exception as error:

        db.session.rollback()

        print(
            "Notification history error:",
            error
        )

        return False
# ==================================================
# EMAIL REMINDER FUNCTIONS
# ==================================================

def send_service_reminder_email(
    user,
    vehicle,
    service,
    reminder_status
):

    if not user.email:
        return False, "User email is missing"

    if reminder_status not in [
        "DUE_SOON",
        "OVERDUE"
    ]:
        return False, "No email required for this status"

    today = date.today().isoformat()

    # Prevent duplicate reminder emails on the same day
    # for the same reminder status.
    if (
        service.last_reminder_date == today
        and service.last_reminder_status == reminder_status
    ):
        return False, "Reminder already sent today"

    if reminder_status == "OVERDUE":

        subject = (
            f"VehicleCare - {service.service_type} is Overdue"
        )

        status_text = "OVERDUE"

    else:

        subject = (
            f"VehicleCare - {service.service_type} is Due Soon"
        )

        status_text = "DUE SOON"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>VehicleCare Service Reminder</title>
    </head>

    <body style="
        margin:0;
        padding:30px;
        background:#f8fafc;
        font-family:Arial,Helvetica,sans-serif;
    ">

        <div style="
            max-width:600px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:14px;
            border:1px solid #e5e7eb;
        ">

            <h1 style="margin-top:0;color:#2563eb;">
                VehicleCare 🚗
            </h1>

            <h2>
                Service Reminder
            </h2>

            <p>
                Hello {user.name},
            </p>

            <p>
                Your vehicle has a service reminder that
                requires your attention.
            </p>

            <div style="
                background:#f8fafc;
                padding:20px;
                border-radius:10px;
                margin:20px 0;
            ">

                <p>
                    <strong>Vehicle:</strong>
                    {vehicle.make} {vehicle.model}
                </p>

                <p>
                    <strong>Vehicle Number:</strong>
                    {vehicle.vehicle_number}
                </p>

                <p>
                    <strong>Service:</strong>
                    {service.service_type}
                </p>

                <p>
                    <strong>Next Service Date:</strong>
                    {service.next_service_date or "Not set"}
                </p>

                <p>
                    <strong>Next Service KM:</strong>
                    {service.next_service_km or "Not set"}
                </p>

                <p>
                    <strong>Current KM:</strong>
                    {vehicle.current_km or 0}
                </p>

                <p>
                    <strong>Status:</strong>
                    {status_text}
                </p>

            </div>

            <p>
                Please schedule your vehicle service as soon
                as possible.
            </p>

            <hr>

            <p style="color:#64748b;font-size:13px;">
                This is an automatic reminder from VehicleCare.
            </p>

        </div>

    </body>
    </html>
    """

    try:

        message = Message(
            subject=subject,
            recipients=[user.email],
            html=html
        )

        mail.send(message)

        service.last_reminder_date = today
        service.last_reminder_status = reminder_status

        db.session.commit()

        save_notification_history(
    user=user,
    vehicle=vehicle,
    service=service,
    notification_type="SERVICE",
    reminder_status=reminder_status,
    recipient=user.email,
    subject=subject,
    status="SENT"
)



        return True, "Email sent successfully"

    except Exception as error:

        db.session.rollback()

        print(
            "Email sending error:",
            error
        )

        return False, str(error)


# ==================================================
# SEND SERVICE REMINDERS
# ==================================================

@app.route(
    "/api/reminders/send",
    methods=["POST"]
)
@jwt_required()
def send_reminders():

    user_id = int(
        get_jwt_identity()
    )

    user = db.session.get(
        User,
        user_id
    )

    if not user:

        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    vehicles = Vehicle.query.filter_by(
        user_id=user_id
    ).all()

    sent = 0
    skipped = 0
    details = []

    for vehicle in vehicles:

        services = Service.query.filter_by(
            vehicle_id=vehicle.id
        ).all()

        for service in services:

            reminder_status = calculate_service_status(
                next_service_date=service.next_service_date,
                next_service_km=service.next_service_km,
                current_km=vehicle.current_km
            )

            if reminder_status not in [
                "DUE_SOON",
                "OVERDUE"
            ]:
                continue

            email_sent, message = send_service_reminder_email(
                user,
                vehicle,
                service,
                reminder_status
            )

            if email_sent:

                sent += 1

                details.append({
                    "service_id": service.id,
                    "vehicle_id": vehicle.id,
                    "status": reminder_status,
                    "result": "sent"
                })

            else:

                skipped += 1

                details.append({
                    "service_id": service.id,
                    "vehicle_id": vehicle.id,
                    "status": reminder_status,
                    "result": message
                })

    return jsonify({

        "success": True,

        "message":
            "Reminder process completed",

        "emails_sent":
            sent,

        "skipped":
            skipped,

        "details":
            details
    })


# ==================================================
# TEST EMAIL
# ==================================================

@app.route(
    "/api/reminders/test",
    methods=["POST"]
)
@jwt_required()
def test_reminder_email():

    user_id = int(
        get_jwt_identity()
    )

    user = db.session.get(
        User,
        user_id
    )

    if not user:

        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    if not user.email:

        return jsonify({
            "success": False,
            "message": "Your account does not have an email address"
        }), 400

    try:

        message = Message(
            subject="VehicleCare Test Email",
            recipients=[user.email],
            html=f"""
            <div style="
                font-family:Arial,sans-serif;
                max-width:600px;
                margin:auto;
                padding:30px;
            ">

                <h1 style="color:#2563eb;">
                    VehicleCare 🚗
                </h1>

                <h2>
                    Email Configuration Successful
                </h2>

                <p>
                    Hello {user.name},
                </p>

                <p>
                    This is a test email from your
                    VehicleCare application.
                </p>

                <p>
                    Your email notification system is
                    working correctly.
                </p>

            </div>
            """
        )

        mail.send(message)

        return jsonify({
            "success": True,
            "message":
                f"Test email sent to {user.email}"
        })

    except Exception as error:

        print(
            "Test email error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                f"Email could not be sent: {error}"
        }), 500


# ==================================================
# RUN REMINDER CHECK NOW
# ==================================================

@app.route(
    "/api/reminders/run-now",
    methods=["POST"]
)
@jwt_required()
def run_reminder_check_now():

    automatic_reminder_job()

    return jsonify({
        "success": True,
        "message":
            "Reminder check completed"
    })


# ==================================================
# DOCUMENT REMINDER SUMMARY
# ==================================================

@app.route(
    "/api/dashboard/document-reminders",
    methods=["GET"]
)
@jwt_required()
def dashboard_document_reminders():

    user_id = int(get_jwt_identity())

    vehicles = Vehicle.query.filter_by(
        user_id=user_id
    ).all()

    overdue = []
    due_soon = []
    upcoming = []

    for vehicle in vehicles:

        documents = VehicleDocument.query.filter_by(
            vehicle_id=vehicle.id
        ).all()

        for document in documents:

            status = calculate_document_status(
                document.expiry_date
            )

            data = {
                "id": document.id,
                "vehicle_id": vehicle.id,
                "vehicle_number":
                    vehicle.vehicle_number,
                "vehicle_name":
                    f"{vehicle.make} {vehicle.model}",
                "document_type":
                    document.document_type,
                "document_number":
                    document.document_number,
                "expiry_date":
                    document.expiry_date,
                "status":
                    status
            }

            if status == "OVERDUE":
                overdue.append(data)

            elif status == "DUE_SOON":
                due_soon.append(data)

            else:
                upcoming.append(data)

    return jsonify({
        "success": True,
        "summary": {
            "overdue": len(overdue),
            "due_soon": len(due_soon),
            "upcoming": len(upcoming),
            "total":
                len(overdue)
                + len(due_soon)
                + len(upcoming)
        },
        "overdue": overdue,
        "due_soon": due_soon,
        "upcoming": upcoming
    })


# ==================================================
# DASHBOARD REMINDER SUMMARY
# ==================================================

@app.route(
    "/api/dashboard/reminders",
    methods=["GET"]
)
@jwt_required()
def dashboard_reminders():

    user_id = int(get_jwt_identity())

    # Get all vehicles of logged-in user
    vehicles = Vehicle.query.filter_by(
        user_id=user_id
    ).all()

    overdue = []
    due_soon = []
    upcoming = []

    for vehicle in vehicles:

        services = Service.query.filter_by(
            vehicle_id=vehicle.id
        ).all()

        for service in services:

            reminder_status = calculate_service_status(
                next_service_date=
                    service.next_service_date,

                next_service_km=
                    service.next_service_km,

                current_km=
                    vehicle.current_km
            )

            service_data = {

                "service_id": service.id,

                "vehicle_id": vehicle.id,

                "vehicle_number":
                    vehicle.vehicle_number,

                "vehicle_name":
                    f"{vehicle.make} {vehicle.model}",

                "service_type":
                    service.service_type,

                "next_service_date":
                    service.next_service_date,

                "next_service_km":
                    service.next_service_km,

                "current_km":
                    vehicle.current_km,

                "status":
                    reminder_status
            }


            if reminder_status == "OVERDUE":

                overdue.append(service_data)


            elif reminder_status == "DUE_SOON":

                due_soon.append(service_data)


            else:

                upcoming.append(service_data)


    return jsonify({

        "success": True,

        "summary": {

            "overdue":
                len(overdue),

            "due_soon":
                len(due_soon),

            "upcoming":
                len(upcoming),

            "total":
                len(overdue)
                + len(due_soon)
                + len(upcoming)
        },

        "overdue":
            overdue,

        "due_soon":
            due_soon,

        "upcoming":
            upcoming
    })

# ==================================================
# NOTIFICATION HISTORY API
# ==================================================

@app.route(
    "/api/notifications/history",
    methods=["GET"]
)
@jwt_required()
def get_notification_history():

    user_id = int(
        get_jwt_identity()
    )


    notifications = (
        NotificationHistory.query
        .filter_by(
            user_id=user_id
        )
        .order_by(
            NotificationHistory.sent_at.desc()
        )
        .all()
    )


    result = []


    for notification in notifications:

        vehicle = None

        if notification.vehicle_id:

            vehicle = db.session.get(
                Vehicle,
                notification.vehicle_id
            )


        service = None

        if notification.service_id:

            service = db.session.get(
                Service,
                notification.service_id
            )


        document = None

        if notification.document_id:

            document = db.session.get(
                VehicleDocument,
                notification.document_id
            )


        result.append({

            "id":
                notification.id,

            "notification_type":
                notification.notification_type,

            "reminder_status":
                notification.reminder_status,

            "recipient":
                notification.recipient,

            "subject":
                notification.subject,

            "status":
                notification.status,

            "error_message":
                notification.error_message,

            "sent_at":
                notification.sent_at.isoformat()
                if notification.sent_at
                else None,

            "vehicle": {

                "id":
                    vehicle.id
                    if vehicle
                    else None,

                "vehicle_number":
                    vehicle.vehicle_number
                    if vehicle
                    else None,

                "name":
                    f"{vehicle.make} {vehicle.model}"
                    if vehicle
                    else None
            },

            "service": {

                "id":
                    service.id
                    if service
                    else None,

                "service_type":
                    service.service_type
                    if service
                    else None
            },

            "document": {

                "id":
                    document.id
                    if document
                    else None,

                "document_type":
                    document.document_type
                    if document
                    else None,

                "expiry_date":
                    document.expiry_date
                    if document
                    else None
            }

        })


    return jsonify({

        "success": True,

        "count":
            len(result),

        "notifications":
            result

    })
# =========================
# RUN SERVER
# =========================

if __name__ == "__main__":

    # Flask's debug reloader starts the application twice.
    # Start the scheduler only in the actual serving process.
    if (
        not app.debug
        or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    ):
        start_reminder_scheduler()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )