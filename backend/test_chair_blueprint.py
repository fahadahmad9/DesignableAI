import math
from pathlib import Path

import numpy as np
import matplotlib.gridspec as gridspec
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle


BACKGROUND_COLOR = "white"
LINE_COLOR = "black"
OBJECT_LINE_WIDTH = 1.8
DIMENSION_LINE_WIDTH = 0.8
SCALE = 1.0  # drawing units per cm
VIEW_MARGIN = 12
BASE_RADIUS_FACTOR = 0.45


def _normalize_design(design):
    defaults = {
        "chair_type": "generic",
        "seat_width": 48,
        "seat_depth": 46,
        "seat_height": 45,
        "backrest_height": 55,
        "backrest_curve": False,
        "armrest_height": 65,
        "has_armrests": False,
        "has_headrest": False,
        "headrest_height": 78,
        "base_type": "four_leg",
        "wheel_radius": 2.2,
        "seat_thickness": 6,
        "backrest_thickness": 3,
    }
    normalized = {**defaults, **design}
    normalized["chair_type"] = str(normalized["chair_type"]).lower()

    # Chair archetype defaults/overrides for base behavior.
    base_unspecified = "base_type" not in design or design.get("base_type") in {None, ""}
    if normalized["chair_type"] == "lounge" and base_unspecified:
        normalized["base_type"] = "sled"
    elif normalized["chair_type"] == "wingback":
        normalized["base_type"] = "four_leg"

    normalized["base_type"] = str(normalized["base_type"]).lower()
    return normalized


def _scaled_geometry(design):
    seat_w = design["seat_width"] * SCALE
    seat_d = design["seat_depth"] * SCALE
    seat_h = design["seat_height"] * SCALE  # floor to top of seat
    back_h = design["backrest_height"] * SCALE
    arm_h = design["armrest_height"] * SCALE
    seat_t = design["seat_thickness"] * SCALE
    back_t = design["backrest_thickness"] * SCALE
    head_h = 0
    if design["has_headrest"]:
        head_target = design["headrest_height"] * SCALE
        head_h = max(8 * SCALE, head_target - (seat_h + back_h))
    arm_t = 2.5 * SCALE
    arm_offset = 2.5 * SCALE
    wheel_r = design["wheel_radius"] * SCALE
    base_radius = seat_w * BASE_RADIUS_FACTOR

    seat_bottom = seat_h - seat_t
    seat_top = seat_h
    back_top = seat_top + back_h
    total_h = back_top + head_h

    return {
        "seat_w": seat_w,
        "seat_d": seat_d,
        "seat_h": seat_h,
        "seat_bottom": seat_bottom,
        "seat_top": seat_top,
        "back_h": back_h,
        "back_top": back_top,
        "arm_h": arm_h,
        "seat_t": seat_t,
        "back_t": back_t,
        "head_h": head_h,
        "arm_t": arm_t,
        "arm_offset": arm_offset,
        "wheel_r": wheel_r,
        "base_radius": base_radius,
        "total_h": total_h,
    }


def _view_bounds(view, geometry):
    if view == "front":
        width = max(geometry["seat_w"] + 20, geometry["base_radius"] * 2 + 24) + 2 * VIEW_MARGIN
        height = geometry["total_h"] + 2 * VIEW_MARGIN + 18
    elif view == "side":
        width = max(geometry["seat_d"] + 20, geometry["base_radius"] * 1.6 + 20) + 2 * VIEW_MARGIN
        height = geometry["total_h"] + 2 * VIEW_MARGIN + 18
    else:
        seat_box = max(geometry["seat_w"], geometry["seat_d"])
        base_box = geometry["base_radius"] * 2 + 16
        width = max(seat_box + 30, base_box + 30) + 2 * VIEW_MARGIN
        height = max(seat_box + 30, base_box + 30) + 2 * VIEW_MARGIN
    return width, height


def _view_origin(view, geometry):
    width, height = _view_bounds(view, geometry)

    if view == "front":
        return (width - geometry["seat_w"]) / 2, VIEW_MARGIN
    if view == "side":
        return (width - geometry["seat_d"]) / 2, VIEW_MARGIN
    return (width - geometry["seat_w"]) / 2, (height - geometry["seat_d"]) / 2


def _style_view(ax, view, design, geometry):
    width, height = _view_bounds(view, geometry)
    if view == "front":
        title = "Front View"
    elif view == "side":
        title = "Side View"
    else:
        title = "Top View"

    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.set_aspect("equal")
    ax.set_facecolor(BACKGROUND_COLOR)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.text(
        0.02,
        0.98,
        title,
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=11,
        color=LINE_COLOR,
    )


def _rect(ax, x, y, w, h):
    ax.add_patch(
        Rectangle(
            (x, y),
            w,
            h,
            fill=False,
            edgecolor=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
    )


def _rounded_rect(ax, x, y, w, h, rounding=1.8):
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle=f"round,pad=0.02,rounding_size={rounding}",
            fill=False,
            edgecolor=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
    )


def _poly(ax, points):
    ax.add_patch(
        Polygon(
            points,
            closed=True,
            fill=False,
            edgecolor=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
    )


def draw_five_star_base(ax, cx, cy, leg_length=16, wheel_radius=2.5, y_scale=1.0):
    hub_radius = max(2.2, wheel_radius * 1.25)
    ax.add_patch(
        Circle(
            (cx, cy),
            radius=hub_radius,
            fill=False,
            edgecolor=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
    )

    for i in range(5):
        angle_deg = -90 + (72 * i)
        angle = math.radians(angle_deg)
        dx = leg_length * math.cos(angle)
        dy = leg_length * math.sin(angle) * y_scale
        ex = cx + dx
        ey = cy + dy
        ax.plot([cx, ex], [cy, ey], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)

        # Caster: short vertical connector, fork, and wheel circle.
        connector_drop = wheel_radius * 1.1
        conn_x = ex
        conn_y_top = ey
        conn_y_bottom = ey - connector_drop
        ax.plot([conn_x, conn_x], [conn_y_top, conn_y_bottom], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)

        wheel_center_x = conn_x
        wheel_center_y = conn_y_bottom - wheel_radius
        fork_half = wheel_radius * 0.9
        ax.plot(
            [conn_x - fork_half, wheel_center_x - wheel_radius * 0.2],
            [conn_y_bottom, wheel_center_y + wheel_radius * 0.35],
            color=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
        ax.plot(
            [conn_x + fork_half, wheel_center_x + wheel_radius * 0.2],
            [conn_y_bottom, wheel_center_y + wheel_radius * 0.35],
            color=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
        ax.add_patch(
            Circle(
                (wheel_center_x, wheel_center_y),
                radius=wheel_radius,
                fill=False,
                edgecolor=LINE_COLOR,
                linewidth=OBJECT_LINE_WIDTH,
            )
        )


def _draw_profile_caster(ax, x, y, wheel_radius):
    connector_h = wheel_radius * 0.95
    fork_half = wheel_radius * 0.9
    wheel_center_y = y - connector_h - wheel_radius

    ax.plot([x, x], [y, y - connector_h], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
    ax.plot(
        [x - fork_half, x - wheel_radius * 0.15],
        [y - connector_h, wheel_center_y + wheel_radius * 0.35],
        color=LINE_COLOR,
        linewidth=OBJECT_LINE_WIDTH,
    )
    ax.plot(
        [x + fork_half, x + wheel_radius * 0.15],
        [y - connector_h, wheel_center_y + wheel_radius * 0.35],
        color=LINE_COLOR,
        linewidth=OBJECT_LINE_WIDTH,
    )
    ax.add_patch(
        Circle(
            (x, wheel_center_y),
            radius=wheel_radius,
            fill=False,
            edgecolor=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
    )


def _draw_plan_five_star_base(ax, cx, cy, leg_length, wheel_radius):
    hub_radius = max(2.4, wheel_radius * 1.35)
    ax.add_patch(
        Circle(
            (cx, cy),
            radius=hub_radius,
            fill=False,
            edgecolor=LINE_COLOR,
            linewidth=OBJECT_LINE_WIDTH,
        )
    )

    for i in range(5):
        angle = math.radians(-90 + 72 * i)
        ex = cx + leg_length * math.cos(angle)
        ey = cy + leg_length * math.sin(angle)
        ax.plot([cx, ex], [cy, ey], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
        wheel_offset = leg_length + wheel_radius * 0.4
        wx = cx + wheel_offset * math.cos(angle)
        wy = cy + wheel_offset * math.sin(angle)
        ax.add_patch(
            Circle(
                (wx, wy),
                radius=wheel_radius,
                fill=False,
                edgecolor=LINE_COLOR,
                linewidth=OBJECT_LINE_WIDTH,
            )
        )


def draw_seat(ax, design, view):
    geometry = _scaled_geometry(design)
    chair_type = str(design.get("chair_type", "generic")).lower()
    left, base_y = _view_origin(view, geometry)
    seat_top_y = base_y + geometry["seat_top"]
    seat_t_effective = geometry["seat_t"] * 1.3 if chair_type == "lounge" else geometry["seat_t"]
    seat_bottom_y = seat_top_y - seat_t_effective
    cushion_h = seat_t_effective * 0.65
    support_h = seat_t_effective * 0.35

    side_depth = geometry["seat_d"]
    side_left = left
    if view == "side" and chair_type == "lounge":
        # Lounge profile reads deeper in side elevation.
        side_depth = geometry["seat_d"] * 1.08
        side_left = left - geometry["seat_d"] * 0.04

    if view == "front":
        _rect(ax, left, seat_bottom_y, geometry["seat_w"], support_h)
        _rect(ax, left, seat_top_y - cushion_h, geometry["seat_w"], cushion_h)
    elif view == "side":
        _rect(ax, side_left, seat_bottom_y, side_depth, support_h)
        _rect(ax, side_left, seat_top_y - cushion_h, side_depth, cushion_h)
    else:
        y = base_y
        _rect(ax, left, y, geometry["seat_w"], geometry["seat_d"])
        inset = 1.8 * SCALE
        _rect(ax, left + inset, y + inset, geometry["seat_w"] - 2 * inset, geometry["seat_d"] - 2 * inset)


def draw_backrest(ax, design, view):
    geometry = _scaled_geometry(design)
    chair_type = str(design.get("chair_type", "generic")).lower()
    left, base_y = _view_origin(view, geometry)
    seat_top = base_y + geometry["seat_top"]

    if view == "front":
        inset = geometry["seat_w"] * 0.08
        _rect(
            ax,
            left + inset,
            seat_top,
            geometry["seat_w"] - (2 * inset),
            geometry["back_h"],
        )
        if chair_type == "wingback":
            wing_start_y = seat_top + geometry["back_h"] * 0.60
            wing_h = geometry["back_h"] * 0.32
            wing_ext = geometry["seat_w"] * 0.12
            back_left_x = left + inset
            back_right_x = left + geometry["seat_w"] - inset

            _poly(
                ax,
                [
                    (back_left_x, wing_start_y),
                    (back_left_x - wing_ext, wing_start_y + wing_h * 0.20),
                    (back_left_x - wing_ext * 0.95, wing_start_y + wing_h),
                    (back_left_x, wing_start_y + wing_h * 0.88),
                ],
            )
            _poly(
                ax,
                [
                    (back_right_x, wing_start_y),
                    (back_right_x + wing_ext, wing_start_y + wing_h * 0.20),
                    (back_right_x + wing_ext * 0.95, wing_start_y + wing_h),
                    (back_right_x, wing_start_y + wing_h * 0.88),
                ],
            )
        if geometry["head_h"] > 0:
            head_w = geometry["seat_w"] * 0.55
            head_x = left + (geometry["seat_w"] - head_w) / 2
            _rounded_rect(ax, head_x, seat_top + geometry["back_h"], head_w, geometry["head_h"], rounding=2.2)
    elif view == "side":
        seat_rear_x = left + geometry["seat_d"]
        back_h = geometry["back_h"]
        back_t = geometry["back_t"]
        sd = geometry["seat_d"]
        if chair_type == "lounge":
            recline_angle_deg = 16
            recline_dx = back_h * math.tan(math.radians(recline_angle_deg))
            x_inner_bottom = seat_rear_x - sd * 0.08
            x_inner_top = x_inner_bottom + recline_dx
            shell = back_t * 1.9
            x_outer_bottom = x_inner_bottom + shell
            x_outer_top = x_inner_top + shell
            _poly(
                ax,
                [
                    (x_inner_bottom, seat_top),
                    (x_inner_top, seat_top + back_h),
                    (x_outer_top, seat_top + back_h),
                    (x_outer_bottom, seat_top),
                ],
            )
        elif chair_type == "wingback":
            x_back = seat_rear_x - sd * 0.06
            top_dx = back_h * math.tan(math.radians(3))
            _poly(
                ax,
                [
                    (x_back, seat_top),
                    (x_back + top_dx, seat_top + back_h),
                    (x_back + top_dx + back_t * 1.8, seat_top + back_h),
                    (x_back + back_t * 1.8, seat_top),
                ],
            )
        elif design.get("backrest_curve", False):
            # Smooth ergonomic S-curve via parametric equations
            n_pts = 60
            t = np.linspace(0, 1, n_pts)

            # Vertical positions along backrest
            y = seat_top + t * back_h

            # Horizontal profile: lumbar push forward, shoulder pull back, overall backward tilt
            lumbar_push = sd * 0.10 * np.sin(t * np.pi * 0.7)
            shoulder_pull = sd * 0.25 * t ** 1.8
            tilt = sd * 0.05 * t
            x_inner = seat_rear_x - sd * 0.05 - lumbar_push + shoulder_pull - tilt

            # Outer curve offset by shell thickness
            shell = back_t * 1.6
            x_outer = x_inner + shell

            # Draw inner (front) edge
            ax.plot(x_inner, y, color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            # Draw outer (rear) edge
            ax.plot(x_outer, y, color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            # Close bottom edge
            ax.plot([x_inner[0], x_outer[0]], [y[0], y[0]], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            # Close top edge
            ax.plot([x_inner[-1], x_outer[-1]], [y[-1], y[-1]], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
        else:
            rear_x = seat_rear_x - geometry["back_t"]
            _rect(
                ax,
                rear_x,
                seat_top,
                geometry["back_t"],
                geometry["back_h"],
            )
        if geometry["head_h"] > 0:
            head_w = 11 * SCALE
            head_x = left + geometry["seat_d"] - head_w * 1.05
            head_y = seat_top + geometry["back_h"] - 0.2 * SCALE
            _rounded_rect(ax, head_x, head_y, head_w, geometry["head_h"] * 0.9, rounding=2.2)
    else:
        band = max(4 * SCALE, geometry["seat_d"] * 0.12)
        y = base_y
        _rect(ax, left + geometry["seat_w"] * 0.08, y + geometry["seat_d"] - band, geometry["seat_w"] * 0.84, band)


def draw_armrests(ax, design, view):
    if not design["has_armrests"]:
        return

    geometry = _scaled_geometry(design)
    chair_type = str(design.get("chair_type", "generic")).lower()
    left, base_y = _view_origin(view, geometry)
    seat_top = base_y + geometry["seat_top"]
    arm_y = base_y + geometry["arm_h"]
    support_h = max(0, arm_y - seat_top)

    if view == "front":
        if chair_type == "wingback":
            arm_w = geometry["seat_w"] * 0.16
            arm_h_block = max(geometry["seat_t"] * 0.95, geometry["arm_t"] * 2.1)
            arm_block_y = arm_y - geometry["arm_t"] * 0.15
            _rect(ax, left + 1.8 * SCALE, arm_block_y, arm_w, arm_h_block)
            _rect(ax, left + geometry["seat_w"] - arm_w - 1.8 * SCALE, arm_block_y, arm_w, arm_h_block)
        else:
            support_w = 3.0 * SCALE if chair_type == "lounge" else 2.2 * SCALE
            arm_len = 10 * SCALE if chair_type == "lounge" else 7 * SCALE
            side_inset = 1.8 * SCALE if chair_type == "lounge" else 2.8 * SCALE
            pad_inset = 1.0 * SCALE if chair_type == "lounge" else 1.8 * SCALE
            _rect(ax, left + side_inset, seat_top, support_w, support_h)
            _rect(
                ax,
                left + geometry["seat_w"] - side_inset - support_w,
                seat_top,
                support_w,
                support_h,
            )
            _rounded_rect(ax, left + pad_inset, arm_y, arm_len, geometry["arm_t"], rounding=1.4)
            _rounded_rect(ax, left + geometry["seat_w"] - arm_len - pad_inset, arm_y, arm_len, geometry["arm_t"], rounding=1.4)
    elif view == "side":
        if chair_type == "wingback":
            arm_start_x = left + geometry["seat_d"] * 0.10
            arm_len = geometry["seat_d"] * 0.75
            arm_h_block = geometry["arm_t"] * 2.0
            _rect(ax, arm_start_x, arm_y - geometry["arm_t"] * 0.10, arm_len, arm_h_block)
        elif chair_type == "lounge":
            arm_start_x = left - geometry["seat_d"] * 0.04
            arm_len = geometry["seat_d"] * 1.08
            front_post_x = arm_start_x + arm_len * 0.16
            rear_post_x = arm_start_x + arm_len * 0.78
            post_w = 2.6 * SCALE
            _rect(ax, front_post_x, seat_top, post_w, support_h)
            _rect(ax, rear_post_x, seat_top, post_w, support_h)

            rear_rise = geometry["seat_t"] * 0.22
            arm_hh = geometry["arm_t"] * 1.35
            _poly(
                ax,
                [
                    (arm_start_x, arm_y),
                    (arm_start_x + arm_len, arm_y + rear_rise),
                    (arm_start_x + arm_len, arm_y + rear_rise + arm_hh),
                    (arm_start_x, arm_y + arm_hh),
                ],
            )
        else:
            arm_start_x = left
            arm_len = geometry["seat_d"]
            front_post_x = arm_start_x + arm_len * 0.15
            rear_post_x = arm_start_x + arm_len * 0.75
            post_w = 1.8 * SCALE
            _rect(ax, front_post_x, seat_top, post_w, support_h)
            _rect(ax, rear_post_x, seat_top, post_w, support_h)
            _rounded_rect(ax, arm_start_x, arm_y, arm_len, geometry["arm_t"], rounding=1.2)
    else:
        arm_d = geometry["seat_d"] * 0.62
        arm_y_top = base_y + geometry["seat_d"] * 0.17
        _rounded_rect(ax, left - 4.2 * SCALE, arm_y_top, 3.2 * SCALE, arm_d, rounding=1.0)
        _rounded_rect(ax, left + geometry["seat_w"] + 1.0 * SCALE, arm_y_top, 3.2 * SCALE, arm_d, rounding=1.0)


def draw_base(ax, design, view):
    geometry = _scaled_geometry(design)
    base = design["base_type"]
    left, origin_y = _view_origin(view, geometry)
    floor = VIEW_MARGIN if view != "top" else origin_y - geometry["seat_d"] * 0.55
    seat_bottom = origin_y + geometry["seat_bottom"]
    leg_w = 2.6 * SCALE
    inset = 4.5 * SCALE

    if base == "four_leg":
        if view == "front":
            _rect(ax, left + inset, floor, leg_w, geometry["seat_h"])
            _rect(ax, left + geometry["seat_w"] - inset - leg_w, floor, leg_w, geometry["seat_h"])
        elif view == "side":
            _rect(ax, left + inset, floor, leg_w, geometry["seat_h"])
            _rect(ax, left + geometry["seat_d"] - inset - leg_w, floor, leg_w, geometry["seat_h"])
        else:
            s = 4 * SCALE
            _rect(ax, left + inset, VIEW_MARGIN + 10 + inset, s, s)
            _rect(ax, left + geometry["seat_w"] - inset - s, VIEW_MARGIN + 10 + inset, s, s)
            _rect(ax, left + inset, VIEW_MARGIN + 10 + geometry["seat_d"] - inset - s, s, s)
            _rect(
                ax,
                left + geometry["seat_w"] - inset - s,
                VIEW_MARGIN + 10 + geometry["seat_d"] - inset - s,
                s,
                s,
            )
    elif base == "sled":
        if view in {"front", "side"}:
            span = geometry["seat_w"] if view == "front" else geometry["seat_d"]
            _rect(ax, left + inset, floor + 2 * SCALE, leg_w, geometry["seat_h"] - 2 * SCALE)
            _rect(ax, left + span - inset - leg_w, floor + 2 * SCALE, leg_w, geometry["seat_h"] - 2 * SCALE)
            ax.plot(
                [left + inset, left + span - inset],
                [floor + 2 * SCALE, floor + 2 * SCALE],
                color=LINE_COLOR,
                linewidth=OBJECT_LINE_WIDTH,
            )
        else:
            y1 = VIEW_MARGIN + 10 + 6 * SCALE
            y2 = VIEW_MARGIN + 10 + geometry["seat_d"] - 6 * SCALE
            ax.plot([left + 2 * SCALE, left + geometry["seat_w"] - 2 * SCALE], [y1, y1], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            ax.plot([left + 2 * SCALE, left + geometry["seat_w"] - 2 * SCALE], [y2, y2], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
    elif base == "five_star":
        if view == "front":
            span = geometry["seat_w"]
            cx = left + span / 2
            hub_y = floor + geometry["wheel_r"] * 2.2
            column_h = max(5 * SCALE, seat_bottom - hub_y)
            column_w = geometry["seat_w"] * 0.06

            _rect(ax, cx - column_w / 2, hub_y, column_w, column_h)
            draw_five_star_base(
                ax,
                cx,
                hub_y,
                leg_length=geometry["base_radius"] * 0.65,
                wheel_radius=geometry["wheel_r"],
                y_scale=0.26,
            )
        elif view == "side":
            cx = left + geometry["seat_d"] * 0.52
            hub_y = floor + geometry["wheel_r"] * 3.4
            column_h = max(5 * SCALE, seat_bottom - hub_y)
            column_w = geometry["seat_w"] * 0.06

            _rect(ax, cx - column_w / 2, hub_y, column_w, column_h)

            leg_half_span = geometry["base_radius"] * 0.58
            front_leg_end_x = cx + leg_half_span
            rear_leg_end_x = cx - leg_half_span
            leg_y = hub_y - geometry["wheel_r"] * 0.3
            ax.plot([cx, front_leg_end_x], [hub_y, leg_y], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            ax.plot([cx, rear_leg_end_x], [hub_y, leg_y], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            ax.plot([cx, cx], [hub_y, hub_y - geometry["wheel_r"] * 1.1], color=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH)
            _draw_profile_caster(ax, front_leg_end_x, leg_y, geometry["wheel_r"])
            _draw_profile_caster(ax, rear_leg_end_x, leg_y, geometry["wheel_r"])
        else:
            cx = left + geometry["seat_w"] / 2
            cy = origin_y + geometry["seat_d"] / 2
            _draw_plan_five_star_base(
                ax,
                cx,
                cy,
                leg_length=geometry["base_radius"] * 0.65,
                wheel_radius=geometry["wheel_r"] * 0.82,
            )
    elif base == "pedestal":
        if view in {"front", "side"}:
            span = geometry["seat_w"] if view == "front" else geometry["seat_d"]
            cx = left + span / 2
            _rect(ax, cx - 3 * SCALE, floor + 4 * SCALE, 6 * SCALE, geometry["seat_h"] - 4 * SCALE)
            _rect(ax, cx - span * 0.28, floor, span * 0.56, 4 * SCALE)
        else:
            cx = left + geometry["seat_w"] / 2
            cy = VIEW_MARGIN + 10 + geometry["seat_d"] / 2
            ax.add_patch(Circle((cx, cy), radius=min(geometry["seat_w"], geometry["seat_d"]) * 0.23, fill=False, edgecolor=LINE_COLOR, linewidth=OBJECT_LINE_WIDTH))
            _rect(ax, cx - geometry["seat_w"] * 0.28, cy - geometry["seat_d"] * 0.15, geometry["seat_w"] * 0.56, geometry["seat_d"] * 0.3)
    else:
        draw_base(ax, {**design, "base_type": "four_leg"}, view)


def draw_dimensions(ax, design, view):
    geometry = _scaled_geometry(design)
    left, base_y = _view_origin(view, geometry)
    floor = VIEW_MARGIN
    seat_top = base_y + geometry["seat_top"]
    back_top = seat_top + geometry["back_h"]

    if view == "front":
        y = VIEW_MARGIN - 4
        ax.annotate(
            "",
            xy=(left + geometry["seat_w"], y),
            xytext=(left, y),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text(left + geometry["seat_w"] / 2, y - 2.2, f"{design['seat_width']} cm", ha="center", va="top", fontsize=7)

        x = left - 8
        ax.annotate(
            "",
            xy=(x, seat_top),
            xytext=(x, floor),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text(x - 1.8, (floor + seat_top) / 2, f"{design['seat_height']} cm", ha="right", va="center", fontsize=7, rotation=90)
    elif view == "side":
        y = VIEW_MARGIN - 4
        ax.annotate(
            "",
            xy=(left + geometry["seat_d"], y),
            xytext=(left, y),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text(left + geometry["seat_d"] / 2, y - 2.2, f"{design['seat_depth']} cm", ha="center", va="top", fontsize=7)

        x = left + geometry["seat_d"] + 8
        ax.annotate(
            "",
            xy=(x, seat_top),
            xytext=(x, floor),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text(x + 1.8, (floor + seat_top) / 2, f"seat_height {design['seat_height']} cm", ha="left", va="center", fontsize=7, rotation=90)

        x2 = x + 6
        ax.annotate(
            "",
            xy=(x2, back_top),
            xytext=(x2, seat_top),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text(x2 + 1.8, (seat_top + back_top) / 2, f"backrest_height {design['backrest_height']} cm", ha="left", va="center", fontsize=7, rotation=90)

        if design.get("has_armrests", False):
            x3 = x2 + 6
            arm_y = base_y + geometry["arm_h"]
            ax.annotate(
                "",
                xy=(x3, arm_y),
                xytext=(x3, floor),
                arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
            )
            ax.text(x3 + 1.8, (floor + arm_y) / 2, f"armrest_height {design['armrest_height']} cm", ha="left", va="center", fontsize=7, rotation=90)
    else:
        y0 = base_y
        y1 = y0 + geometry["seat_d"]
        y = y0 - 6
        x0 = left
        x1 = left + geometry["seat_w"]

        ax.annotate(
            "",
            xy=(x1, y),
            xytext=(x0, y),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text((x0 + x1) / 2, y - 2.2, f"seat_width {design['seat_width']} cm", ha="center", va="top", fontsize=7)

        x = x1 + 6
        ax.annotate(
            "",
            xy=(x, y1),
            xytext=(x, y0),
            arrowprops=dict(arrowstyle="<->", color=LINE_COLOR, lw=DIMENSION_LINE_WIDTH),
        )
        ax.text(x + 1.8, (y0 + y1) / 2, f"seat_depth {design['seat_depth']} cm", ha="left", va="center", fontsize=7, rotation=90)


def draw_chair(ax, design, view):
    design = _normalize_design(design)
    geometry = _scaled_geometry(design)
    _style_view(ax, view, design, geometry)
    draw_base(ax, design, view)
    draw_seat(ax, design, view)
    draw_backrest(ax, design, view)
    draw_armrests(ax, design, view)
    draw_dimensions(ax, design, view)


def generate_blueprint(design):
    design = _normalize_design(design)
    fig = plt.figure(figsize=(13, 10), facecolor=BACKGROUND_COLOR)
    gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.28, wspace=0.18)

    ax_front = fig.add_subplot(gs[0, 0])
    ax_side = fig.add_subplot(gs[0, 1])
    ax_top = fig.add_subplot(gs[1, :])

    draw_chair(ax_front, design, "front")
    draw_chair(ax_side, design, "side")
    draw_chair(ax_top, design, "top")

    fig.suptitle(f"{design['chair_type'].title()} Chair Blueprint", fontsize=15, y=0.98)
    images_dir = Path(__file__).parent / "images"
    images_dir.mkdir(exist_ok=True)
    chair_type_slug = str(design.get("chair_type", "chair")).strip().lower().replace(" ", "_")
    output = images_dir / f"chair_blueprint_{chair_type_slug}.png"
    plt.savefig(output, dpi=300, facecolor=BACKGROUND_COLOR, bbox_inches="tight")
    plt.close(fig)
    return output



DESIGN_OFFICE_CHAIR = {
    "chair_type": "office",
    "seat_width": 50,
    "seat_depth": 45,
    "seat_height": 42,
    "backrest_height": 65,
    "backrest_curve": True,
    "has_armrests": True,
    "armrest_height": 60,
    "has_headrest": True,
    "headrest_height": 80,
    "base_type": "five_star",
    "wheel_radius": 2.5,
}

DESIGN_WINGBACK_CHAIR = {
    "chair_type": "wingback",
    "seat_width": 60,
    "seat_depth": 55,
    "seat_height": 45,
    "backrest_height": 95,
    "backrest_curve": False,
    "has_armrests": True,
    "armrest_height": 65,
    "has_headrest": False,
    "base_type": "four_leg",
    "seat_thickness": 8,
    "backrest_thickness": 6,
}

DESIGN_LOUNGE_CHAIR = {
    "chair_type": "lounge",
    "seat_width": 70,
    "seat_depth": 65,
    "seat_height": 35,
    "backrest_height": 70,
    "backrest_curve": True,
    "has_armrests": True,
    "armrest_height": 55,
    "has_headrest": False,
    "base_type": "sled",
    "seat_thickness": 10,
    "backrest_thickness": 6,
}

if __name__ == "__main__":

    designs = [
        DESIGN_OFFICE_CHAIR,
        DESIGN_LOUNGE_CHAIR,
        DESIGN_WINGBACK_CHAIR,
    ]

    for design in designs:
        output_path = generate_blueprint(design)
        print(f"{design['chair_type']} blueprint saved to: {output_path.resolve()}")
