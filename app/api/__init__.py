try:
    from . import auth_wechat  # noqa: F401
except ImportError:
    pass

try:
    from . import auth  # noqa: F401
except ImportError:
    pass

try:
    from . import routes  # noqa: F401
except ImportError:
    pass
