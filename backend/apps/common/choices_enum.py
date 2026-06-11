from enum import Enum, EnumMeta


class ChoicesEnumMeta(EnumMeta):
    """Django CharField choices: Class.choices -> [(value, name), ...]."""

    def __iter__(self):
        return ((x.value, x.name) for x in super().__iter__())

    def __getattribute__(cls, name):
        if name == "choices":
            members = super().__getattribute__("__members__")
            return [(m.value, m.name) for m in members.values()]
        return super().__getattribute__(name)


class ChoicesEnum(Enum, metaclass=ChoicesEnumMeta):
    def __str__(self) -> str:
        return self.name
