from datetime import date, datetime, timedelta, timezone


def get_local_now():
    return datetime.now().astimezone()


def get_day_bounds(target_date: date):
    local_timezone = datetime.now().astimezone().tzinfo or timezone.utc
    day_start_local = datetime.combine(target_date, datetime.min.time(), tzinfo=local_timezone)
    next_day_start_local = day_start_local + timedelta(days=1)

    return (
        day_start_local.astimezone(timezone.utc).replace(tzinfo=None),
        next_day_start_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def convert_storage_datetime_to_local(value: datetime | None):
    if not value:
        return None

    local_timezone = datetime.now().astimezone().tzinfo or timezone.utc
    return value.replace(tzinfo=timezone.utc).astimezone(local_timezone)


def serialize_local_datetime(value: datetime | None):
    local_datetime = convert_storage_datetime_to_local(value)
    return local_datetime.isoformat(timespec="seconds") if local_datetime else None
