import math
from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.config import (
    ATTENDANCE_GEOFENCE_LATITUDE,
    ATTENDANCE_GEOFENCE_LONGITUDE,
    ATTENDANCE_GEOFENCE_MAX_ACCURACY_METERS,
    ATTENDANCE_GEOFENCE_RADIUS_METERS,
    ATTENDANCE_MIN_CAPTURE_SECONDS,
)
from app.models import AttendanceRecord
from app.students import get_public_student_id, get_student_by_identifier
from app.time_utils import get_day_bounds, serialize_local_datetime
from app.validation import parse_iso_date, parse_iso_datetime, validate_attendance_status


def format_attendance_requirement_value(value: float):
    return f"{value:g}"


def get_attendance_geofence_configuration():
    if ATTENDANCE_GEOFENCE_LATITUDE is None or ATTENDANCE_GEOFENCE_LONGITUDE is None:
        raise HTTPException(
            status_code=503,
            detail="Attendance geofence is not configured on the server yet.",
        )

    return (
        ATTENDANCE_GEOFENCE_LATITUDE,
        ATTENDANCE_GEOFENCE_LONGITUDE,
        ATTENDANCE_GEOFENCE_RADIUS_METERS,
    )


def haversine_distance_meters(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float):
    earth_radius_meters = 6_371_000
    latitude_a_radians = math.radians(latitude_a)
    latitude_b_radians = math.radians(latitude_b)
    latitude_delta = math.radians(latitude_b - latitude_a)
    longitude_delta = math.radians(longitude_b - longitude_a)

    haversine_value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(latitude_a_radians)
        * math.cos(latitude_b_radians)
        * math.sin(longitude_delta / 2) ** 2
    )
    angular_distance = 2 * math.atan2(math.sqrt(haversine_value), math.sqrt(1 - haversine_value))

    return earth_radius_meters * angular_distance


def build_attendance_verification_details(
    *,
    hold_seconds: float | None = None,
    accuracy_meters: float | None = None,
    geofence_distance_meters: float | None = None,
):
    detail_parts = []

    if hold_seconds is not None:
        detail_parts.append(f"live hold {hold_seconds:.1f}s")

    if accuracy_meters is not None:
        detail_parts.append(f"location accuracy {accuracy_meters:.1f}m")

    if geofence_distance_meters is not None:
        detail_parts.append(f"distance from geofence center {geofence_distance_meters:.1f}m")

    return ", ".join(detail_parts)


def validate_attendance_capture_hold(capture_started_at: str | None, capture_completed_at: str | None):
    parsed_started_at = parse_iso_datetime(capture_started_at or "", "capture_started_at")
    parsed_completed_at = parse_iso_datetime(capture_completed_at or "", "capture_completed_at")
    hold_seconds = (parsed_completed_at - parsed_started_at).total_seconds()

    if hold_seconds < 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid live capture timing data.",
        )

    if hold_seconds + 0.05 < ATTENDANCE_MIN_CAPTURE_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Stay in the live camera frame for at least "
                f"{format_attendance_requirement_value(ATTENDANCE_MIN_CAPTURE_SECONDS)} "
                "seconds before attendance is captured."
            ),
        )

    return hold_seconds


def validate_attendance_geofence(
    latitude: float | None,
    longitude: float | None,
    accuracy_meters: float | None,
):
    if latitude is None or longitude is None or accuracy_meters is None:
        raise HTTPException(
            status_code=400,
            detail="Location access is required to mark attendance inside the configured geofence.",
        )

    if not -90 <= latitude <= 90:
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90.")

    if not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180.")

    if accuracy_meters < 0:
        raise HTTPException(status_code=400, detail="Location accuracy must be zero or greater.")

    geofence_latitude, geofence_longitude, geofence_radius_meters = get_attendance_geofence_configuration()

    if accuracy_meters > ATTENDANCE_GEOFENCE_MAX_ACCURACY_METERS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Location accuracy must be within "
                f"{format_attendance_requirement_value(ATTENDANCE_GEOFENCE_MAX_ACCURACY_METERS)} "
                "meters to mark attendance."
            ),
        )

    distance_meters = haversine_distance_meters(
        latitude,
        longitude,
        geofence_latitude,
        geofence_longitude,
    )

    if distance_meters > geofence_radius_meters:
        raise HTTPException(
            status_code=403,
            detail="You are outside the allowed attendance area.",
        )

    return distance_meters


def serialize_attendance(record: AttendanceRecord):
    return {
        "id": record.id,
        "student_id": get_public_student_id(record.student) or str(record.student_id),
        "student_name": record.student.full_name if record.student else "Unknown Student",
        "status": record.status,
        "marked_at": serialize_local_datetime(record.marked_at),
    }


def get_attendance_or_404(attendance_id: int, db: Session):
    attendance = db.query(AttendanceRecord).filter(AttendanceRecord.id == attendance_id).first()

    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    return attendance


def get_filtered_attendance_records(
    db: Session,
    search: str | None = None,
    status: str | None = None,
    student_id: str | None = None,
    attendance_date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort_by: str | None = None,
    sort_direction: str | None = None,
):
    query = db.query(AttendanceRecord).options(joinedload(AttendanceRecord.student))

    if status and status != "all":
        query = query.filter(AttendanceRecord.status == validate_attendance_status(status))

    if student_id is not None:
        student = get_student_by_identifier(student_id, db)

        if not student:
            return []

        query = query.filter(AttendanceRecord.student_id == student.id)

    if attendance_date:
        parsed_date = parse_iso_date(attendance_date, "date")
        day_start, next_day_start = get_day_bounds(parsed_date)
        query = query.filter(
            AttendanceRecord.marked_at >= day_start,
            AttendanceRecord.marked_at < next_day_start,
        )

    if date_from:
        parsed_date_from = parse_iso_date(date_from, "start date")
        day_start, _ = get_day_bounds(parsed_date_from)
        query = query.filter(AttendanceRecord.marked_at >= day_start)

    if date_to:
        parsed_date_to = parse_iso_date(date_to, "end date")
        _, next_day_start = get_day_bounds(parsed_date_to)
        query = query.filter(AttendanceRecord.marked_at < next_day_start)

    records = query.all()
    normalized_search = (search or "").strip().lower()

    if normalized_search:
        filtered_records = []

        for record in records:
            haystack = (
                f"{record.student.full_name if record.student else ''} "
                f"{get_public_student_id(record.student) or record.student_id} "
                f"{record.status}"
            ).lower()

            if normalized_search in haystack:
                filtered_records.append(record)

        records = filtered_records

    resolved_sort_by = sort_by or "marked_at"
    resolved_sort_direction = (sort_direction or "desc").lower()

    if resolved_sort_by == "student_name":
        records.sort(
            key=lambda record: (
                record.student.full_name.lower() if record.student else "",
                get_public_student_id(record.student) or str(record.student_id),
            ),
            reverse=resolved_sort_direction == "desc",
        )
    elif resolved_sort_by == "status":
        records.sort(
            key=lambda record: (
                record.status.lower(),
                get_public_student_id(record.student) or str(record.student_id),
            ),
            reverse=resolved_sort_direction == "desc",
        )
    elif resolved_sort_by == "student_id":
        records.sort(
            key=lambda record: get_public_student_id(record.student) or str(record.student_id),
            reverse=resolved_sort_direction == "desc",
        )
    else:
        records.sort(
            key=lambda record: record.marked_at or datetime.min,
            reverse=resolved_sort_direction != "asc",
        )

    return records


def build_attendance_export_filename(
    status: str | None,
    student_id: str | None,
    attendance_date: str | None,
    date_from: str | None,
    date_to: str | None,
):
    name_parts = ["attendance_report"]

    if attendance_date:
        name_parts.append(attendance_date)
    elif date_from and date_to:
        name_parts.append(f"{date_from}_to_{date_to}")
    elif date_from:
        name_parts.append(f"from_{date_from}")
    elif date_to:
        name_parts.append(f"until_{date_to}")
    else:
        name_parts.append("all_dates")

    if status and status != "all":
        name_parts.append(status)

    if student_id is not None:
        name_parts.append(f"student_{student_id}")

    return f"{'_'.join(name_parts)}.csv"
