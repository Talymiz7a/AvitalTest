class NotFound(Exception):
    def __init__(self, what: str):
        super().__init__(f"{what} not found")


class BadRequest(Exception):
    pass
