// Enhancements added to MenuItemCard

import React from 'react';
import './CardStyles.css'; // Make sure to import your CSS styles

const MenuItemCard = ({ item }) => {
    return (
        <div className={`menu-item-card card-hover`}>  {/* Added hover class */}
            <div className={`badge-container glow-on-hover`}> {/* Added glow class */}
                {item.bestseller && <span className={`badge badge-pulse`}>Bestseller</span>} {/* Added pulse class */}
            </div>
            <h3>{item.title}</h3>
            <p className={`price price-highlight`}>${item.price}</p> {/* Added highlight class */}
            <div className={`variants-dropdown smooth-expand`}> {/* Added expand animation */}
                {/* Variants dropdown implementation */}
            </div>
        </div>
    );
};

export default MenuItemCard;
