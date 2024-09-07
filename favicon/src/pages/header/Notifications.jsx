import React, { useEffect, useState, useRef } from "react";
import Cookies from "js-cookie";
import { FaBell } from "react-icons/fa";
import NotificationList from "./NotificationList";
import { useNavigate } from "react-router-dom";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const accessToken = Cookies.get("access");

      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/users/logout`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        Cookies.remove("access");
        Cookies.remove("refresh");
        Cookies.remove("userEmail");
        navigate("/login");
      } else {
        console.error("Failed to logout");
      }
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      const accessToken = Cookies.get("access");

      if (!accessToken) return;

      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/users/alarm`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.status === 401) {
          // Access Token 만료: 로그아웃 로직 추가
          handleLogout();
          return;
        }

        if (response.ok) {
          const data = await response.json();
          console.log(data); // 데이터 구조 확인
          setNotifications(data);
        } else {
          console.error("Failed to fetch notifications");
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      }
    };

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 5000); // 5초마다 폴링

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationRef]);

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleDeleteNotification = async (id) => {
    const accessToken = Cookies.get("access");
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/users/alarm/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
      } else {
        console.error("Failed to delete notification");
      }
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  return (
    <div className="relative" ref={notificationRef}>
      <button onClick={handleNotificationClick} className="relative">
        <FaBell />
        {notifications.length > 0 && <span className="notification-count">{notifications.length}</span>}
      </button>
      {showNotifications && (
        <NotificationList
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onDelete={handleDeleteNotification}
        />
      )}
    </div>
  );
};

export default Notifications;