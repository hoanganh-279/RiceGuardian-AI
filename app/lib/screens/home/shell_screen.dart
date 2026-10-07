import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../config/app_colors.dart';

class _TabItem {
  const _TabItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

const _tabs = [
  _TabItem(
    icon: Icons.home_outlined,
    activeIcon: Icons.home_rounded,
    label: 'Trang chủ',
  ),
  _TabItem(
    icon: Icons.eco_outlined,
    activeIcon: Icons.eco_rounded,
    label: 'Ruộng',
  ),
  _TabItem(
    icon: Icons.photo_camera_rounded,
    activeIcon: Icons.photo_camera_rounded,
    label: 'Chụp ảnh',
  ),
  _TabItem(
    icon: Icons.warning_amber_rounded,
    activeIcon: Icons.warning_rounded,
    label: 'Cảnh báo',
  ),
  _TabItem(
    icon: Icons.person_outline_rounded,
    activeIcon: Icons.person_rounded,
    label: 'Cá nhân',
  ),
];

const _cameraIndex = 2;
const _barHeight = 80.0;
const _pillTop = 12.0;
const _labelTop = _pillTop + 32 + 4;
const _labelStyleSize = 12.0;
const _fade = Duration(milliseconds: 200);

class ShellScreen extends StatelessWidget {
  const ShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: RiceBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: _onTap,
      ),
    );
  }
}

/// Bottom navigation for the 5 main tabs.
class RiceBottomNav extends StatelessWidget {
  const RiceBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 4,
            offset: Offset(0, -1),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: _barHeight,
          child: Row(
            children: [
              for (var i = 0; i < _tabs.length; i++)
                Expanded(
                  child: i == _cameraIndex
                      ? _CameraItem(
                          label: _tabs[i].label,
                          selected: i == currentIndex,
                          index: i,
                          onTap: () => onTap(i),
                        )
                      : _NavItem(
                          tab: _tabs[i],
                          selected: i == currentIndex,
                          index: i,
                          onTap: () => onTap(i),
                        ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

TextStyle _labelStyle(bool selected) => TextStyle(
      fontSize: _labelStyleSize,
      height: 1.2,
      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
      color: selected ? AppColors.primary : AppColors.textSecondary,
    );

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tab,
    required this.selected,
    required this.index,
    required this.onTap,
  });

  final _TabItem tab;
  final bool selected;
  final int index;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: '${tab.label}, tab ${index + 1} trên ${_tabs.length}',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              top: _pillTop,
              child: Material(
                color: Colors.transparent,
                shape: const StadiumBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onTap,
                  splashColor: AppColors.primary.withValues(alpha: 0.12),
                  child: AnimatedContainer(
                    duration: _fade,
                    width: 56,
                    height: 32,
                    color: selected
                        ? AppColors.primary.withValues(alpha: 0.18)
                        : Colors.transparent,
                    child: Icon(
                      selected ? tab.activeIcon : tab.icon,
                      size: 24,
                      color:
                          selected ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: _labelTop,
              left: 0,
              right: 0,
              child: AnimatedDefaultTextStyle(
                duration: _fade,
                style: _labelStyle(selected),
                child: Text(
                  tab.label,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.visible,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CameraItem extends StatefulWidget {
  const _CameraItem({
    required this.label,
    required this.selected,
    required this.index,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final int index;
  final VoidCallback onTap;

  @override
  State<_CameraItem> createState() => _CameraItemState();
}

class _CameraItemState extends State<_CameraItem> {
  static const _button = 48.0;
  static const _gap = 3.0;
  static const _outer = _button + _gap * 2;

  bool _pressed = false;

  void _setPressed(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    return Semantics(
      button: true,
      selected: selected,
      label: '${widget.label}, tab ${widget.index + 1} trên ${_tabs.length}',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              top: _labelTop - _outer - 2,
              child: AnimatedScale(
                scale: _pressed ? 0.96 : 1,
                duration: const Duration(milliseconds: 100),
                child: Container(
                  width: _outer,
                  height: _outer,
                  padding: const EdgeInsets.all(_gap),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.2),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 100),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _pressed
                          ? Color.lerp(AppColors.primary, Colors.black, 0.08)
                          : AppColors.primary,
                    ),
                    child: const Icon(
                      Icons.photo_camera_rounded,
                      size: 24,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: _labelTop,
              left: 0,
              right: 0,
              child: AnimatedDefaultTextStyle(
                duration: _fade,
                style: _labelStyle(selected),
                child: Text(
                  widget.label,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.visible,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
